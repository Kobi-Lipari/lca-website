# WS09, Clubs as living listings: the plan

Written on Thursday, November 12, 2026, for the clubs stream and its builders. K's own copy, in plain words, is kept beside this file as `ws09-summary.md`; the steps a builder works from are in `ws09-manifest.json`, one entry per step, and every step below is in it. One plan made from two outlines (staff first, and risk first) and five reports on the code, the brief, the decisions, the boards and the dependencies. Facts were checked on `main` at `af4a21c` and in the brief's WS09 section (lines 2062 to 2300). Nothing was built. Every date and every count of days is an estimate. Revised once after two reviews that tried to break it; what changed is in section 14.

## 1. In short

1. **38 steps in eight checkpoints, lettered S to Z.** The staff half is S, T, U and V (steps 1 to 19); the public half is W, X, Y and Z (steps 20 to 38).
2. **The ground comes first.** Checkpoint S changes no page. It closes a leak (today's public club answer sends every column of the table, so every new column would be public at once), then adds the tables and fills them for today's 25 clubs, safely.
3. **Then the people who keep listings.** Checkpoint T is the one editor. Checkpoint U is My region and the monthly check. Checkpoint V is representatives' club events, which wait for an LCA admin's approval. K can turn the staff pages on in production while every public page stays today's.
4. **Then the public.** Checkpoint W is the club page. X is the contact form that never shows an address, and the other forms. Y is the directory. Z is photos, the last removals and the full browser check.
5. **Dates.** Building starts about Tuesday, November 17, 2026, if K has answered choices 1 to 4 by Monday, November 16, 2026. The editor, My region and the monthly check are ready for K's look about Tuesday, December 1, 2026 (estimate; range Monday, November 30 to Tuesday, December 8, 2026); the whole staff half about Thursday, December 3, 2026 (estimate; range Wednesday, December 2 to Friday, December 11, 2026); everything about Wednesday, December 23, 2026 (estimate; range Friday, December 18, 2026 to Friday, January 15, 2027).
6. **Two more switches** are asked of K, `clubKeepers` and `regionEvents`, beside the brief's `newClubs`, because one switch cannot turn the staff pages on ahead of the public ones (choice 2). The switches go on in an order a test holds: K's own `clubEmailHidden` first, then `clubKeepers`, then `regionEvents`, then `newClubs` with `newLook`.
7. **Migrations run from 0065 to 0071**, seven files, all additive. The repository allows the gap after 0060. The generator gains a number option so neither stream is handed the other's numbers. Two files write to live rows; section 5 says how each is proved safe.
8. **Three shared pieces** the brief gives to other workstreams do not exist and are built here under the brief's own names: signed links, the record of timed runs, and the rate limit. Follow, follower emails, Add to calendar, road miles and address lookup are left out, each because its base does not exist.
9. **The mail stream's held files** are avoided. Three single lines are asked of it (two in the worker, one in a browser test), each with a way to go on if the answer is late. It is also told three things before checkpoint S: how numbers are given out, that S merges after its checkpoint P, and what the preview bucket does to its previews (section 7).
10. **K has eight choices** (section 9). Choices 1 to 4 come before building starts. The brief's defaults the plan builds on are listed after them, so no choice is hidden.

## 2. The order and the checkpoints

Each checkpoint is one draft pull request with pictures, mergeable alone. With every switch off, production behaves exactly as today after each merge, except for the few things section 5 and the checkpoint notes name, each needing K's yes. Before each pull request `main` is brought into the branch and the full gate is run again. A merge waits for K's word, goes one at a time with the mail stream's, and never lands on K's switch-on day, the cutover day, the first newsletter's day, or while a newsletter is sending. Checkpoint S merges after the mail stream's checkpoint P, so the clubs stream is the second to merge and does the regenerating and the re-pinning (section 5). A merge that carries a migration is finished only when the Apply database migrations run is seen green, before the live check; a failed run is run again until it passes.

### What each checkpoint holds

| Letter | Steps | Holds | Switch | Migrations | What K can look at | What a keeper or a visitor could do once its switch is on |
|---|---|---|---|---|---|---|
| S | 1 to 5 | The ground: a named public answer, the switches, the regions, the club tables, the seed | none needed | 0065, 0066, 0067 | A check sheet of all 25 clubs as they will be filled in; no page | Nothing new. With K's yes to choice 1, the filled regions show on today's public clubs page and its region buttons filter, and a region's seat holder can edit that region's clubs on today's admin page, without the roster or officers' emails |
| T | 6 to 9 | The one editor, basics first, with its previews; Your club's page | `clubKeepers` | none | Pictures of the editor on a computer and a phone | An LCA admin, a club's rep or a region's representative keeps a club's listing. K enters the 25 clubs' basics. Visitors see today's pages, showing what keepers save; `clubEmailHidden` is on first, so the club's email is not printed |
| U | 10 to 15 | My region, each club's page in it, the monthly check and its no-login link | `clubKeepers` | 0068 | Pictures of My region and of the email | A representative sees a card per club, taps Still accurate, opens a club, edits its listing or posts its news, and gets the monthly email |
| V | 16 to 19 | Representatives' club events with approval | `regionEvents` | 0069 | Pictures of the Events tab, the fee notice and the approval | A representative drafts a club's event, names its director and submits it; an LCA admin approves and publishes |
| W | 20 to 24 | The club page, its server side, the sitemap | `newClubs` | none | Pictures and a preview of the new club page, bare and full | Nothing until the last checkpoint; a club's keepers, signed in, see the page beside the editor, and no one else can read it |
| X | 25 to 31 | The rate limit and spam check, the contact relay, Reply through LCA, Suggest an update, Suggest a club, Ask to be its named rep | `newClubs` | 0070 | Pictures of each form and of My region's to-do rows | Nothing public yet; keepers' rows fill once the public switch is on |
| Y | 32 to 35 | The directory | `newClubs` | none | A preview of the directory on a computer and a phone | Nothing until the last checkpoint |
| Z | 36 to 38 | Photos, players not tied to clubs, the browser matrix, the switch-on notes | `newClubs` | 0071 | The whole public side on a preview | After K's switch-on: a visitor finds a club, reads its page, writes to it without seeing an address, suggests an update or a club |

### The days

The pace: a small step about 3 hours, a medium step about 4, a large step about 8; about 8 hours of building a working day; a checkpoint about ½ day of review and fixes, then K's look. Thanksgiving is Thursday, November 26, 2026, and K's looks around it may be slow. The mail stream's days as its plan gives them: K's switch-on about Wednesday, November 18, 2026, then the cutover and the first newsletter; checkpoint N about Monday, November 23; checkpoint P about Wednesday, November 25; checkpoint Q about Monday, November 30; checkpoint O about Friday, December 18, 2026. No clubs merge is planned on any of them, and none in the week of Monday, November 16, 2026.

| Checkpoint | Hours of steps | Ready for K's look (estimate) | Merged on K's word (estimate; range) |
|---|---|---|---|
| S | 19 | Thursday, November 19, 2026 | Friday, November 27, 2026, after the mail stream's checkpoint P (Friday, November 27 to Wednesday, December 2) |
| T | 19 | Tuesday, November 24, 2026 | Tuesday, December 1, 2026 (Tuesday, December 1 to Monday, December 7) |
| U | 27 | Tuesday, December 1, 2026 | Thursday, December 3, 2026 (Wednesday, December 2 to Thursday, December 10) |
| V | 16 | Thursday, December 3, 2026 | Monday, December 7, 2026 (Friday, December 4 to Monday, December 14) |
| W | 24 | Wednesday, December 9, 2026 | Friday, December 11, 2026 (Thursday, December 10 to Thursday, December 17) |
| X | 31 | Tuesday, December 15, 2026 | Thursday, December 17, 2026 (Wednesday, December 16 to Wednesday, December 23, and not Friday, December 18, the mail stream's checkpoint O day) |
| Y | 20 | Friday, December 18, 2026 | Tuesday, December 22, 2026 (Monday, December 21, 2026 to Wednesday, January 6, 2027) |
| Z | 16, plus a day of browser runs | Wednesday, December 23, 2026 | Monday, January 4, 2027 (Monday, December 28, 2026 to Friday, January 15, 2027) |

That is about 172 hours of steps, about 22 working days, and about 4 days of checkpoint closes. Each day the start slips moves every line by a day.

**For a board meeting in December 2026**, whose date has not been given:
- In the week of Monday, November 30, 2026: the editor and Your club's page, live if K has turned `clubEmailHidden` and then `clubKeepers` on; My region and the monthly email in pictures.
- On or after Monday, December 7, 2026: all of that live, with a representative's club event through approval. The first real monthly check can land on Monday, December 7, 2026 at 8:00 AM, the first Monday of the month, if checkpoint U has merged, K has set the signing secret and `clubKeepers` is on.
- After Monday, December 14, 2026: the new club page on a preview as well.
- Not live in December on any date: the public pages and forms, and so My region's to-do rows with real suggestions in them.

### What reads the new tables with every switch off, merge by merge

Each of these is live the moment its checkpoint merges, so each catches a missing table or column with one log line and goes on, as the mail stream did for 0060, and each merge's note to K lists them.

- **S:** deleting a member, deleting a club and creating a club (the slug check) read 0066's tables and columns. By choice 1, today's admin club page answers a region's representative without the roster.
- **U:** nothing reads 0068 with the switch off. The timed run writes no row and makes no query unless a check is due and the switch is on.
- **V:** the two public tournament answers send the whole row, so 0069's four columns are named manager-only in the same step; a test holds both answers unchanged byte for byte.
- **W:** by choice 8 (a), today's club answer finds a club by its slug (a column 0066 added weeks earlier).
- **X and Z:** nothing reads 0070 with the switch off; the club delete clears 0071's photos.

## 3. The steps

One paragraph each. The manifest holds the files, the tests by name, the criteria and the checked facts for each.

### Checkpoint S: the ground. No page; no switch needed

**Step 1, `ws09-01-the-record-and-a-named-public-answer` (small).** Today `GET /api/clubs/[id]` answers `SELECT *`, so any new column would be public the moment it exists, member ids among them, and the strict contract would fail. The step names today's 13 columns in the select and in an allow-list, with a test that a column added to the table never reaches the answer and a test that today's answer has not changed by a byte. It also gives `GET /api/clubs` its contract and opens the WS09 section of the record with its map of the brief's 16 criteria.

**Step 2, `ws09-02-the-switches-and-the-preview-bucket` (medium).** Adds `clubKeepers` and `regionEvents` after `newClubs`, and the three server constants in the brief's file, `functions/utils/clubs/pages.ts`, with one test holding each pair equal. The same test holds the order the switches may go on in, so a switch-on out of order fails the gate: `clubKeepers` and `newClubs` only with `clubEmailHidden` on, `newClubs` only with `newLook` on, `regionEvents` only with `clubKeepers` on. The migration generator gains a `--number` option with its own test cases, and the migrations README says who holds which numbers. All switches are added in one step so the count moves once. If K has made the bucket `lca-club-logos-preview`, the preview is bound to it here; if not, the binding rides with the first later step after K has, and step 36 does not start without it.

**Step 3, `ws09-03-the-regions-fill` (medium).** Migration 0065: Appendix C's regions, by club id, only where a region is blank. It needs K's yes by itself (choice 1), because with every switch off a filled region does three things at once: today's public clubs page prints the region on each card and its region buttons start to filter; a regional seat holder can open and save that region's clubs on today's admin club page (`canManageClub` already admits them); and that page would show them the club's roster with members' emails, US Chess IDs, ratings and membership status, and the officers' emails. By choice 1 (a) the third is held back in this step: a person admitted by the region alone gets no roster and no officer's email, and everyone else's answer is today's. If K picks 1 (c), the step is dropped and nothing else moves.

**Step 4, `ws09-04-the-club-tables-and-the-slug-rule` (medium).** Migration 0066: the brief's fifteen new columns on `clubs`, and the tables for old addresses, places, suggestions and rep requests. The slug rule. The member delete and the club delete are changed in the same step to clear the new references, or deleting a member who once saved a club would fail in production; both go on, with one log line, if the migration run lags the site's build. Today's club create checks a new club's slug against every club's id, slug and old slug and the reserved words, so a new club named like an existing one gets a suffix and never a failed save.

**Step 5, `ws09-05-the-seed` (medium).** Migration 0067 fills today's clubs: a slug each (six typed out, the rest equal to the club's id), six old-address rows, the 18 meeting statements the Clubs-H board draws, About for the seven clubs with no statement, and a first place with its pin. Every write is to an empty field of a known club id. A check sheet of all 25 goes to K. Section 5 says how it is proved.

### Checkpoint T: the one editor. Switch `clubKeepers`

**Step 6, `ws09-06-saving-a-listing` (large).** The server side: the club save takes the new fields and up to two places, stamps who saved and when, counts as a check, writes the audit row, and emails the region's representative what changed when someone else saved. By choice 3 as recommended, the same save also writes today's fields, never blanking one, so today's club pages show keepers' work at once. Who may save is unchanged: an LCA admin, the club's rep, the region's representative. A changed slug may never be another club's id, slug or old slug, so no club can take an address that leads to another today. With the switch off, a save on today's page sends no notice and writes no stamp, and a test reads the outbox and the four columns to hold that.

**Step 7, `ws09-07-the-editor-basics-first` (medium).** One form for every keeper, in today's admin club page when the switch is on: the five basics first (one sentence, how the club meets, where, the contact name shown, the email for messages). The email's label and Help say "never shown" only while `clubEmailHidden` is on, which step 2's test makes the only state the staff switch can be on in; the promise is never made where today's club page would print the address. Explaining words sit behind a Help button that opens once by itself. With the switch off the page is today's.

**Step 8, `ws09-08-the-rest-of-the-editor-and-its-previews` (medium).** The remaining fields in site order, with the two ticks the filters read, and a preview column: the search result, the share card, the directory card and a page checklist. Photos wait for step 36.

**Step 9, `ws09-09-your-clubs-page-and-the-ways-in` (small).** `/my/club/:slug` for a club's rep, with `/manage/club` and the Workspace's club panel leading there. Closes T. After the merge K turns `clubEmailHidden` on (K's own switch, Q14; today's club page then offers "Contact this club through LCA" in place of the club's address), then, or in the same change, `clubKeepers`, and enters the 25 clubs' basics.

### Checkpoint U: My region and the monthly check. Switch `clubKeepers`

**Step 10, `ws09-10-my-regions-answer-and-still-accurate` (medium).** The read behind My region (a seat holder's clubs, or every club for an LCA admin), Still accurate for one club, the card order, and the rule for the first Monday at 8:00 AM Louisiana time, summer and winter. The check is due on that Monday only, so a switch turned on later in a month sends nothing by itself until the next first Monday.

**Step 11, `ws09-11-the-my-region-page` (medium).** `/workspace/region`: the This month bar, a card per club with its stamp in words, Still accurate and Open, and Confirm all. Any member with an active regional seat gets in, whatever their role. The way in is the Dashboard's "Clubs in your region" block; the header menu is held and not touched.

**Step 12, `ws09-12-a-club-in-my-region` (medium).** Each club's own page in My region with three tabs: Listing (the one editor), News (today's form, moved in unchanged) and Events (a list). No Tonight tab.

**Step 13, `ws09-13-signed-links-and-the-run-record` (medium).** Two shared pieces under the brief's names: `functions/utils/tokens.ts` (signed links with an expiry, and a sealed kind nobody can read) under `SIGNING_SECRET`, and migration 0068 with `recordRun`. Nothing calls them yet.

**Step 14, `ws09-14-the-monthly-check` (large).** One email per representative listing the clubs the seat keeps, each with a Still accurate link that works without a login for 30 days; the small page that link opens; and a button for LCA admins, "Send this month's check now". The due rule and the cap live in the clubs stream's own file. A timed call that is not due, or with the switch off or no secret, returns before any query and writes no row, so the five-minute run adds nothing to production while idle. The admin's button sends to everyone at every press and never stands in for Monday's timed send. The no-login link checks, when it is used, that the person still holds a seat covering the club.

**Step 15, `ws09-15-the-run-calls-the-check` (small; a held file, by agreement).** One line in the worker's five-minute run that calls step 14, placed after the mail stream's send-later phase and the campaign sweep, so the newsletter takes its share of the run first; the run's worst case is counted with those phases when the line is made. WS09 does not wrap the mail stream's send-later phase in `recordRun`, though the mail plan expects it to: that phase is in a held file, and `HANDOFF-ws09.md` says so and says how to wrap it. It is made with the mail stream's word, best after its own send-later phase has merged (about Monday, November 30, 2026). Until it lands, the admin's button sends the check, so checkpoint U does not wait for it.

### Checkpoint V: representatives' club events with approval. Switch `regionEvents`

Built only once K has answered choice 6. If K defers it, these four steps move after checkpoint Y as they stand.

**Step 16, `ws09-16-the-representatives-grant` (medium).** Migration 0069 (four columns on `tournaments`) and a representative's standing on a club event: may create for a club in their region, may not raise a fee above $0, may name directors on their own draft. Two guards come with it. The public tournament answers send the whole row, so the four columns, a member id among them, are named manager-only in the same step, with a test that both public answers are unchanged byte for byte. And the fee refusal sits ahead of the line that lets everyone charge while `CREATION_ROLES_ON` is off (it is off on `main`), so it holds in both states; it is decided by the event's club, so a club rep who also holds a seat keeps today's rule on their own club and gets $0 on another club in the region.

**Step 17, `ws09-17-create-and-run-in-the-region` (medium).** The four grants on the server, each refused while the constant is unset: create, name directors, the membership switch, and running every club event in the region. Publishing is refused in words before approval, whoever tries. A fee above $0 is refused on a create and on a save of any club event reached by the region alone, a club rep's own included, tested with `CREATION_ROLES_ON` unset and set and never with a mocked value. A club rep's own rules on their own club are untouched.

**Step 18, `ws09-18-submit-approve-ask-for-changes` (medium).** Submit for LCA review, Approve and publish (an LCA admin with the second factor) and Ask for changes, each with its email.

**Step 19, `ws09-19-events-on-the-pages` (medium).** Add a club event on the Events tab, the fee notice for a representative, the wait and its buttons on the event's page, "Event in LCA review" in My region. Closes V and the staff half.

### Checkpoint W: the club page. Switch `newClubs`, shown only with `newLook`

**Step 20, `ws09-20-the-page-answer` (medium).** The read behind the new page: which sections have something, the author line, the three nearest clubs, the club's listed events. It never carries an email address, an officer or a roster; a place's name and street are part of it. The public can read it only with `CLUB_PAGES_ON` set. While only the staff switch is on, it answers that club's signed-in keepers and no one else.

**Step 21, `ws09-21-the-page-from-the-top` (large).** The page as Club-Final-Bare draws it: cover with initials, author line, a section nav that lists only what exists, About, When and where with its map. The editor's preview column gains the page itself. A stand-in route for `/clubs/suggest`, present only with `newClubs` on, keeps a menu test green until step 30; with the switch off the address is today's "Club not found".

**Step 22, `ws09-22-the-rest-of-the-page` (medium).** The club's events with full dates and weekdays, club news, nearby clubs, the foot line, Share, and the phone layout with its docked bar. No Follow button and no Add to calendar, since neither has a base yet.

**Step 23, `ws09-23-the-page-before-any-script` (medium).** What a search engine reads: title, description, share card, structured data and the page's words in the HTML, and 301s from today's addresses to the new ones. The address is looked up in a fixed order: a current slug serves the page, and only then does an old slug, or an id that differs from its slug, answer 301; 19 of the 25 clubs have an id equal to their slug, and a test holds that none is sent to itself. With the constant unset the route is today's link preview, byte for byte. By choice 8 (a), today's club answer also learns to find a club by its slug, so the 301s can be lived with if the switch ever goes back off. Contact's heading and line join the server-written words in step 26, with the form.

**Step 24, `ws09-24-the-sitemap-and-the-browser-build` (medium).** `sitemap.xml`, and the first browser checks of a new clubs page. The browser build that has the new look on also turns `newClubs` on, which needs one line in a held test file, asked of the mail stream. Closes W.

### Checkpoint X: the relay and the forms. Switch `newClubs`

**Step 25, `ws09-25-the-limit-and-the-spam-check` (medium).** The rate limit under the brief's names with migration 0070, and the spam check. With no secret set, a form refuses plainly; it never passes silently. The limit's bucket is a keyed hash under a key made from `SIGNING_SECRET` for the limiter alone, because a plain hash of a network address can be undone by trying every address; with that secret missing the limiter refuses and stores nothing.

**Step 26, `ws09-26-the-contact-relay` (medium).** The club page's Contact form: to the club's own email, else to the region's representative with the line that the club has no connected email yet, else to the LCA admins. A club address the mail gate refuses falls to the next keeper, so a dead address does not silence a club. Nothing is stored but the limit's count. The page's server-written words gain Contact's heading and line here, which completes criterion 7.

**Step 27, `ws09-27-reply-through-lca` (medium).** The representative's and the admins' copies get a link to a short form that answers the visitor from LCA's address. The visitor's address is sealed inside the link and stored nowhere.

**Step 28, `ws09-28-suggest-an-update` (large).** The form on the club page, its routing, the keeper's three answers, and My region's to-do rows and "Answer it, then confirm".

**Step 29, `ws09-29-the-fourteen-day-step` (small; one held line, by agreement).** A suggestion unanswered at 14 days also reaches the LCA admins. The logic is the clubs stream's; its line in the worker's daily run waits for the mail stream's word, with an admin's button in front of it. A run with nothing due writes no row.

**Step 30, `ws09-30-suggest-a-club-or-start-one` (medium).** `/clubs/suggest`, routed by city or ZIP from a built-in list of Louisiana places, with a short parish list for K to confirm. These rows have no club, so they are answered through an endpoint of their own, open to an LCA admin or a holder of a seat that covers the row's region. They show in My region, for the representative and in the admin's view; the Admin's clubs list is in a held file and is not touched.

**Step 31, `ws09-31-ask-to-be-its-named-rep` (medium).** The request behind Log in, and Name as rep or Decline for the region's representative or an LCA admin. Naming writes the role and the club together in one batch through a new helper, since no one path writes both today. A representative may name only a plain member; anyone with another role, another club's rep included, goes to the LCA admins unchanged. The question before the press says what the person will be able to do, fees included. Closes X.

### Checkpoint Y: the directory. Switch `newClubs`

**Step 32, `ws09-32-the-list-answer-and-the-order` (medium).** The list's wider answer behind the constant, and the ordering rules: A to Z, nearest with "about N mi" and the 75 mile divider, a name that narrows, filters on list and pins together.

**Step 33, `ws09-33-the-directory-and-its-map` (large).** The drawer beside the map: one-link cards, pins without numbers, count circles, the selected ring in dark gold.

**Step 34, `ws09-34-place-near-me-and-filters` (medium).** The one field, Near me, the two orders, the filters, and the states the boards draw. The device's exact position never leaves it; only a ZIP goes in the page's address, LCA neither logs nor stores it, and the map is the provider's, as today.

**Step 35, `ws09-35-phones-and-below-the-fold` (medium).** The phone map with its sheet, "Who keeps these listings" with Message, and "Not here?". The board contact gains a region target, its contract, the limit and the spam check. Today's `/contact` page draws the spam check and sends its token once `newClubs` is on, in either look, or every general message would be refused from the switch-on. The new strip does not carry "300+ members"; the figure stays on the home page. Closes Y.

### Checkpoint Z: the close. Switch `newClubs`

**Step 36, `ws09-36-club-photos` (large).** Migration 0071, up to six photos with captions, the photo cover, the share picture. The preview bucket bound is a hard precondition: the step neither starts nor merges without it, and if K has not made the bucket by then, steps 37 and 38 go on and photos wait as a checkpoint of their own.

**Step 37, `ws09-37-players-are-not-tied-to-clubs` (medium).** The parts of P2.18 outside held files: the roster and officers tools leave the admin club page and an event set to keep clubmates apart keeps families apart, all only once `newClubs` is on. Each reader of a member's club is listed with its fate.

**Step 38, `ws09-38-the-browser-matrix-and-the-switch-on-notes` (medium).** Three browser runs across every look and width, the record closed over all 16 criteria, and K's notes for turning the switches on, in the held order, with everything `newClubs` turns on at once listed and each order proved green on a throwaway branch.

## 4. The switches and the server constants

| Switch in `src/lib/features.ts` | Server constant in `functions/utils/clubs/pages.ts` | Governs | Can first go on after |
|---|---|---|---|
| `clubKeepers` (new) | `CLUB_KEEPERS_ON` | The editor, Your club's page, My region, Still accurate, the monthly check, the save notice, the keeper's side of suggestions and rep requests | Checkpoint T (the editor); U adds My region |
| `regionEvents` (new) | `REGION_EVENTS_ON` | The representative's four grants and the approval wait | Checkpoint V |
| `newClubs` (exists, off) | `CLUB_PAGES_ON` (the brief's name and file) | The directory, the club pages, the 301s, the server-written page, the sitemap, the relay, the public forms, the P2.18 parts of step 37 | Checkpoint Z |

- Each constant is one line, `export const NAME = false`, under a comment that starts ` * Set: `, in a file that holds constants only and no word `env`, `process.` or `import.meta`, as the two existing switch tests demand. `test/unit/club-pages-switch.test.ts` holds each pair equal. The server reads a constant inside the function at each call.
- The switch count is 43 on `main` and 45 on this branch. The mail stream moves it too; the second to merge moves the figure.
- The new public pages are drawn only when `newClubs` and `newLook` are both on (choice 7). The staff pages work in today's look.
- Switch-on order, held by `test/unit/club-pages-switch.test.ts` so a change out of order cannot merge: `clubEmailHidden` with `CLUB_EMAIL_HIDDEN` (K's own Phase 0 switch, Q14), then `clubKeepers`, then `regionEvents`, then `newClubs` with `newLook` already on. Each is one small change K merges, setting the switch and its constant together.
- Why `clubEmailHidden` is first: the editor tells keepers the email for messages is never shown, and today's club page and today's club answer print it until that switch is on. `newClubs` needs it too, since today's club answer stays live (criterion 8).
- Why `newClubs` needs `newLook`: `CLUB_PAGES_ON` follows `newClubs` alone, so without the new look the server would redirect, write the new page into today's HTML, serve the sitemap, open the forms and empty today's officers list while the browser drew today's pages. The case is dropped only if K picks choice 7 (b).
- `regionEvents` does not need `standingDirectors` or `CREATION_ROLES_ON`: the representative's fee refusal holds in both states (step 16).
- `newClubs` also needs `SIGNING_SECRET` and the spam check's two keys set, or every public form refuses.
- `newClubs` is meant to go on after checkpoint Z. If K wants the public pages sooner, after Y, the photos step then needs a small switch of its own, named then.

## 5. The migrations

**What the reports found about a gap in the numbers.** It is allowed. No test, script, workflow, journal or config checks that numbers run without a gap. Files apply in file-name order; the production ledger records file names, so 0061 to 0064 landing later still apply; two files already share the prefix 0022. Three costs, all mechanical:
- The generator has no number option and writes the highest number plus one. Once checkpoint S put 0065 to 0067 on `main` it would hand everyone 0068, the mail stream included, which is the clubs stream's own number for step 13. So step 2 adds a `--number` option with its test cases, and the README says that 0061 to 0064 are kept for the mail work and 0065 on for the clubs work, each made with the option. No file is renamed by hand.
- More than three tests pin the folder, and each step that adds a file moves all that apply: `drizzle-baseline` (two cases: the file and table counts, and the last file), `db-generate-guard` (the next number), the WS08 step 2 claims test with the README, `seed-fixtures` (the last file's prefix), and, when a file adds a table, a column or a reference, `schema-drift` (36 tables and 343 columns on `main`), `db-generate-real-kit` (the table count and the journal's length) and `migration-safety` (its count of links). The second stream to merge moves them again.
- The staging snapshots collide for certain: both streams write `drizzle/meta/0010_snapshot.json`. The second to merge regenerates, and the kit must then report no changes. The order is settled here: checkpoint S merges after the mail stream's checkpoint P, so the second is the clubs stream and P is asked to change nothing. If P slips past Tuesday, December 1, 2026, the two streams agree the order afresh in writing.

| Number | Name | Holds | Kind | Step |
|---|---|---|---|---|
| 0065 | `club_regions` | Appendix C's regions, by club id, only where blank | Data on live rows; K's yes | 3 |
| 0066 | `club_pages` | Fifteen nullable or defaulted columns on `clubs` with the slug index; `club_slug_history`, `club_places`, `club_reports` (with one added column, `escalated_at`), `club_rep_requests` | Additive | 4 |
| 0067 | `club_pages_seed` | Slugs, six old-address rows, 18 statements, seven About texts, first places, the told month; with K's yes, two clubs' doubled apostrophes in today's text | Data on live rows, empty fields only | 5 |
| 0068 | `automation_runs` | The timed runs' record, as the brief's WS08 section writes it | Additive | 13 |
| 0069 | `club_event_approval` | Four columns on `tournaments` | Additive | 16 |
| 0070 | `rate_limits` | The table as the brief's WS07 section writes it | Additive | 25 |
| 0071 | `club_photos` | The table | Additive | 36 |

Not made: `zip_regions` and `club_distances` (choice 5). No table is rebuilt and nothing is dropped.

**The seed on live data, and how it is proved safe.** Production's club rows cannot be read from the repository, and merging a migration is the release. So:
1. Every value is typed out per club id; nothing is computed from text in SQL.
2. Every write is to an empty field. A statement is written only where the club's description still equals what the old migrations stored, so a line K changed in production is left alone. A club added since gets a slug equal to its id and nothing else.
3. A test runs the file on a database built from the migrations and checks the figures (25 distinct slugs, six old-address rows, 18 statements), that a changed row is left alone, and that a second run changes nothing.
4. It is rehearsed once on the preview database at the checkpoint, K told first.
5. Before the merge, one read-only count per question is asked of production by the hand that holds that right: how many clubs have a region, a stored pin, a description that differs from the seed, an id beyond the 25.
6. K gets a check sheet of all 25 clubs as seeded, with the checkpoint.

Two things in S can be met with every switch off, and each needs K's yes: the regions (choice 1) and the two apostrophes (choice 4). One more comes in W and is K's choice 8: a club's slug typed after `/clubs/` finds today's page instead of "Club not found". Nothing else a person can meet ships with the switches off: the stand-in suggest route exists only with `newClubs` on, and 0069's columns reach no public answer.

## 6. What WS09 builds early under other workstreams' names, and what it leaves out until they land

| The brief assumes | Its owner in the brief | On `main` | In this plan |
|---|---|---|---|
| Signed tokens, `functions/utils/tokens.ts`, `SIGNING_SECRET` | WS06 | absent | Built early under the brief's names (step 13). K sets the secret |
| `automation_runs` and `recordRun` | WS08 | absent | Built early under the brief's names (step 13). The mail plan expects it, and expects WS09 to wrap its send-later phase; WS09 leaves that phase, in a held file, to the mail stream and says so |
| `functions/utils/rateLimit.ts` and `rate_limits` | WS07 | absent | Built early under the brief's names (step 25), with a keyed hash that refuses without `SIGNING_SECRET` |
| The spam check, `functions/utils/spamCheck.ts` | WS09 | absent | Step 25. K adds the two keys |
| A timed phase in the five-minute run | section 2.2 | absent; the run does one thing | The due rule lives in the clubs stream's own file (step 14); one line in the worker by agreement (step 15) |
| `follows` and the outbox | WS07 | absent | Left out: no Follow button, no follower emails. Under the mail engine a follower's email is list mail, so it belongs with clubs' own lists |
| The setup checklist | WS08 | absent | Add a club event opens today's creation steps with the club fixed |
| `publish_at` and the scheduled publish | WS08 | absent | Only publishing by hand is refused before approval; the date's refusal is a written follow-up for WS08 |
| `ADMIN_HOME_ON` and the queue | WS08 | absent | Not made. What reaches the admins goes by email and shows on the admin club page |
| The event's calendar file | WS04 | absent | Add to calendar left out |
| Club news columns, From the clubs | WS10 | absent | Today's title, date and excerpt; no "Also on LCA News" line |
| My LCA's Your club row and Your region rail | WS13 | absent | The ways in are the Dashboard's block, `/manage/club` and the Workspace's club panel |
| About's Volunteer | WS14 | absent | The directory's Volunteer sends through the region target (step 35); WS14 reuses it |
| `listedWhere` leaving member-created events out | WS02, WS08 | the visible rule only | Used as it stands by the club page and the sitemap, so the later rule reaches both with no change here |
| A provider for road miles and address lookup | none | none on the server | Left out (choice 5) |

## 7. The mail stream's held files, and how each is avoided, deferred or asked for

| Held | Would WS09 touch it? | This plan |
|---|---|---|
| `workers/daily-emails/` | Yes: the monthly check and the 14-day clock | Asked for: two single lines (steps 15 and 29), made by the mail stream or with its written word, after its send-later phase merges and never while a newsletter is sending. The check's line runs after the mail phases in the five-minute run. The logic lives in the clubs stream's own package-free files. An LCA admin's button covers both until then |
| `test/a11y/builds.spec.ts` | Yes: one line when the browser build turns `newClubs` on | Asked for once, at step 24. If late, the flip moves to step 38 and checkpoints W to Y show pictures from a local run |
| `functions/utils/admin/campaigns.ts`, `src/pages/AdminEmailPage.tsx` | Only for P2.18's "by club" audience | Deferred to the mail stream, after its checkpoint O; its own step 11 builds on the same lines |
| `src/pages/AdminPage.tsx` | Only for P2.18's members' club column | Deferred with the above. Rep requests and suggestions show on the admin club page, which is not held; Suggest a club and Start a club rows, which have no club, show in the admin's view of My region, not on the Admin's clubs list |
| `src/components/layout/Navbar.tsx` | No | The "My region's clubs" link keeps going to the Dashboard, which gains Open My region |
| `functions/utils/mail/`, `domain/mail/` | No | Every WS09 email is event mail through the one email function |
| `test/a11y/signedIn.ts` | No | The signed-in pages stay out of the browser tests, as the brief says |
| Numbers 0061 to 0064 | No | WS09 starts at 0065. Told to the mail stream before S's pull request opens: from S's merge its files are made with `--number`, and S merges after its checkpoint P |
| The preview's pictures | Its newsletter previews | Told to the mail stream before the merge that binds the preview bucket: every preview then shows no logo, post picture or officer photo until one is uploaded there |

Each ask is written in `HANDOFF-ws09.md` and said to K. Shared files both streams add to (`src/lib/features.ts` and the count tests, the contract registry and the pending count, the api fixture, `src/App.tsx`, `src/areas/admin/api.ts`, `test/integration/harness.ts`, the record): each step adds its own lines at the end of its own group. Also said to the mail stream now: deleting a club that owns a mail list fails today (`mail_lists.club_id` has no delete action); whoever makes clubs' lists mends that delete.

## 8. Where the mail work's later part meets WS09

Planned here, built by neither stream until the mail stream gives its word on the engine's side.

- **A club's own sending.** A fourth tab, Email, beside Listing, News and Events, on Your club's page and on the club's page in My region. It opens the mail page with the club already chosen. The club's list, its footer words, its sender and its audience are the mail stream's. WS09 gives it the place, the club's id (which never changes, since the club's sending address hangs on it) and the reply mailbox: the editor's "Email for messages" is the mailbox replies go to, and the mail page's "Manage senders and where replies go" link lands on that field.
- **A representative's sending.** One button in My region's header, "Email your clubs", beside Post club news. It goes out on each chosen club's list from that club's address, naming the representative inside; a representative has no sending address of their own.
- **A club's tournament send-out.** A row action on a club's event in the Events tab, shown only once the event is listed (for a representative's event, after approval). It opens the mail page's navy tournament template with the club chosen, addressed to the LCA tournament email list on the club's behalf. For now LCA admins, the president and the media manager send it.
- **Follow** becomes the sign-up to a club's list when clubs' lists exist. Until then the button is absent.
- The monthly check, the relay and every other WS09 email stay event mail and belong to no list.

## 9. What K must decide

Recommended first, each with its reason. K may answer "all recommended" or give numbers. Choices 1 to 4 are answered by Monday, November 16, 2026, before building starts; 5 before step 6; 6 before checkpoint V; 7 and 8 before checkpoint W. The manifest's `open_questions_for_k` holds the same eight.

1. **Filling the regions in production.** With every switch off, a filled region does three things at once: today's public clubs page prints each club's region and its region buttons start to filter; a regional seat holder can open and save that region's clubs on today's admin club page; and, unless it is held back, that page shows them the club's roster with members' emails, US Chess IDs, ratings and membership status, and the officers' emails.
   - (a) Recommended: the fill-blank file merges with checkpoint S, after one read of what production holds and after K maps the unmatched Baton Rouge seat, and the roster and officers' emails stay with LCA admins and the club's own rep. My region is empty without regions, a representative needs the listing and not the roster, and the roster tools leave the page in step 37 anyway.
   - (b) The same fill, and representatives see the roster as today's code would let them.
   - (c) K sets each club's region by hand and the file is dropped, with the same three effects for each club K sets.
   - Look at: the brief's Appendix C; today's clubs page and admin club page. Heart of Worship is in South Central Louisiana in Appendix C while its pin sits near Bunkie.
2. **Two more switches for the staff side.**
   - (a) Recommended: `clubKeepers` and `regionEvents`, so the editor and My region can be on in production while the public pages are being built, and showing a page never widens who may create an event. With it, K's own switch that hides a club's email on today's club page (`clubEmailHidden`, Q14) goes on first: the editor tells keepers the email is never shown, and today's page prints it until that switch is on, so a test refuses the staff switch without it.
   - (b) The brief's one switch. No keeper can do real work, and the board sees pictures only, until the whole workstream is done.
   - Look at: section 4; today's club page with its email line.
3. **What today's club pages show while only the staff switch is on.**
   - (a) Recommended: a save in the new editor also writes today's fields, so today's pages show keepers' work at once and K enters each club's basics once. The seven clubs that read "See club for details" get a real line as soon as K types one.
   - (b) Today's form stays beside the new one until the new pages are on, and keepers type things twice.
   - Look at: step 6.
4. **The seed's data points.**
   - (a) Recommended, all of: mend two clubs' doubled apostrophes in today's text too (Slidell and Mandeville; a small visible fix with every switch off); seed each club's pin from the built-in list today's map already uses; keep Shreveport-Bossier's second pin as its second place; keep the one shared New Orleans pin for the two clubs that meet at several sites; leave Heart of Worship's pin and region as stored for K to correct in the editor.
   - (b) Seed no pins and leave today's text. K places all 25, and the apostrophes stay on today's pages.
   - Look at, now: the brief's Appendix C, the Clubs-H board and today's clubs map. The check sheet of all 25 clubs comes with checkpoint S, and K may turn any of these points the other way at that look, before the merge; the file is written so each can be removed alone.
5. **Miles and finding a place** (P2.12).
   - (a) Recommended: straight-line "about N mi", a built-in list of Louisiana ZIP centres and towns, pins set by a click as today. No provider and no cost. A visitor's exact location never leaves their device; only a ZIP goes in the page's address, and LCA neither logs nor stores it; the map itself is the provider's, as today. The honest cost: across the lake or the river the figure reads shorter than the drive.
   - (b) The brief's road miles and address lookup: a server key at the map provider, about $12.50 to $125 once (the provider's price page and one report's arithmetic), a new phase in the held worker, and the provider's terms on keeping results still unread. It can be added later.
   - Look at: the open question printed on the Clubs-H board.
6. **Representatives creating their clubs' events** (Q1 and Q15).
   - (a) Recommended: in the staff half, as checkpoint V, behind its own switch, with every such event waiting for an LCA admin's approval. It is the one representative's workflow that can be shown live with no public page on, and the approval keeps a new power small.
   - (b) The same, after the public pages, about three weeks later.
   - (c) Leave it for the tournament console's workstream.
   - (d) Build it with no approval wait, so a representative's club event lists when they publish it, as a club rep's does (Q15 answered no).
   - In every option a representative's club event stays at $0.
   - Look at: Work-H, and inset G1 of Account-Final-Hub-2.
7. **The look the new public pages need.**
   - (a) Recommended: the new directory and club pages show only once the new look is on as well, as the new menus do, and a test refuses the public switch without it. In today's look the dark gold they rely on is bright gold and fails on white.
   - (b) Make them pass in today's look too, about two more steps.
   - Look at: the `preview-new-look` preview.
8. **A club's new address before the public switch.** From checkpoint W, with every switch off, an address made of a club's new short name (for example `/clubs/example-chess-club`) would show today's club page where it shows "Club not found" today.
   - (a) Recommended: yes. Once the public switch has sent browsers and search engines on to the new addresses, a switch-off still finds the club.
   - (b) No change until the public switch is on. A switch-off after it leaves those visitors at "Club not found".
   - Look at: step 23.

Lines in commits and pull requests about how the text was made are not a choice: K's standing rule 1 and the handoff's git rule already say none, and every step follows them.

**Taken as the brief assumes unless K says otherwise.** Each is safe to build on, because it sits behind a switch or changes nothing today. K's copy points here.
- P2.13: no Copy link control on the directory. P2.14: the home page's this-week strip stays off. P2.15: Appendix C's regions as they stand. P2.16: an open seat's clubs fall to LCA admins. P2.41: the representative's name is shown on each listing.
- P2.18: players are not tied to clubs; the removals take effect only with `newClubs`, and the parts in held files wait for the mail stream.
- Q2: a club's rep keeps today's rule for the club's own events. Q36: Reply through LCA is built, with the visitor's address sealed.
- Q14: `clubEmailHidden` is K's own switch, and it must be on before `clubKeepers` and before `newClubs` (choice 2). It is the one default that changes a page visitors see today, on the day K turns it on.
- The three shared pieces are built early, as the handoff says.
- The region's representative, or an LCA admin, may name a plain member as a club's rep. That hands the member the club rep's rights: the club's page, its events and their fees. The representative is asked no second factor (many have none). Anyone who already holds another role goes to the LCA admins.
- The thin directory card is one link, with "Suggest an update" as plain words on it; the form opens from the club's page.
- Month stamps ("Checked Nov 2026", "As told to LCA, November 2026") carry no weekday, because they name a month.
- The divider sits at 75 miles. Any open suggestion makes Still accurate wait.
- The monthly email is a note about the person's own seat and carries no unsubscribe line. It goes on the first Monday only; an admin's button sends it on any other day, to everyone, at each press.
- A club's own words are shown as typed; only the seed and the site's own words follow the writing rules.
- An admin's club edit asks no second factor, as today; Approve and publish does.
- No Follow button and no Add to calendar until their bases exist. Work-H-2's extra fields, Change history and Set the crop are not built.
- The new clubs page's strip reads "{N} clubs · 7 regions", as the board draws it, without "300+ members"; the figure stays on the home page, where K's standing rule 4 keeps it.
- Today's club pages' two contrast follow-ups (the map's loading note and the Upcoming badge) are not mended in today's look; they end when the new pages replace those pages.
- The public pages go on after checkpoint Z.

## 10. What K must do with K's own hands, and when

| What | When |
|---|---|
| Answer choices 1 to 4 | By Monday, November 16, 2026, for a start on Tuesday, November 17, 2026 |
| One read of production, or a go for the clubs session to make it: which clubs have a region, which seats cover a region, the counts of section 5 | Before checkpoint S merges |
| Map the "Baton Rouge / East Central Representative" seat to South Central Louisiana in Board seats | Before or right after checkpoint S merges |
| Create the picture bucket `lca-club-logos-preview` | Best before step 2; step 36 does not start without it. After it is bound, a preview shows no logo, post picture or officer photo until one is uploaded there |
| Turn `clubEmailHidden` on, then `clubKeepers`, then enter the 25 clubs' basics from the check sheet, one short form each | After checkpoint T merges. The first changes today's club page: the club's address gives way to "Contact this club through LCA" |
| Set `SIGNING_SECRET` on the site and, typed separately, on the worker; on Preview only if links are to be shown there | Before the first monthly check or before `newClubs` goes on, whichever comes first; without it the timed check sends nothing and every public form refuses |
| Say which week the board meets | Any time; it sets what is shown live |
| Add the spam check's site key and secret to the site | Before `newClubs` goes on; the forms refuse plainly until then |
| Confirm the short parish list that places each ZIP in a region | With checkpoint X |
| Look at each checkpoint and give the word to merge; be told before each rehearsal on the preview database | Each checkpoint |
| After a merge that carries a migration, see Apply database migrations go green, or have the clubs session watch it and say so, before the live check | Checkpoints S, U, V, X and Z |
| Turn `regionEvents` on, then, with the new look on and the secret and keys set, `newClubs` | After checkpoint V, and after checkpoint Z |

## 11. The risks

1. **The seed meets rows nobody has read.** Empty fields only, typed values, a rehearsal, the counts and K's sheet. The worst case is a club left bare for K to fill.
2. **Regions open three things at once**: labels and filtering on today's public clubs page, editing for seat holders, and, unless held back, the roster with members' emails. Named in choice 1, whose recommended option holds the roster back. The unmatched seat leaves the Baton Rouge clubs to the admins until K maps it.
3. **A column leaks.** Step 1's allow-list and its test come before any column; the new page's answer has a strict contract of its own.
4. **The 301s are hard to take back.** By choice 8 (a) today's page finds a slug in both switch states; the lookup order keeps a club whose id is its slug from being sent to itself; the switch-on is K's.
5. **The relay is an open door.** It fails closed without the spam secret, is limited per place and per club, stores nothing, and logs no message, name or address.
6. **The mirror can drift** if the staff switch goes on, off and on again. The editor shows a one-line note on a field that differs.
7. **Two streams, one set of pinned counts and one snapshot chain.** Switches, pending contracts, handler files, migration files. The second to merge brings `main` in and re-counts; about an hour a checkpoint, inside the ½ day.
8. **The worker's two lines wait on the mail stream.** The admin's button covers both. If the word never comes, both stay manual, and the record says so.
9. **The widest change of who may do what** is checkpoint V. It sits behind its own constant, every cell is refused while it is unset, the fee refusal does not lean on any other switch, and Q1 and Q15 are put to K first. Naming a club's rep (step 31) is the second: it hands a plain member the club rep's rights, fees included, on a representative's word with no second factor, and is on K's list of defaults.
10. **Shared pieces inherited by three workstreams.** Small shapes, each signature written in the record; each owner may still widen them.
11. **`members.role` holds one role.** A director, an officer or another club's rep cannot be named a club's rep by a representative; the request goes to the admins with the reason and nothing changes.
12. **Boards with gaps.** No phone frames for My region, the editor or the forms; no drawn state for a sent, failed or limited form. Each step makes a plain one-column layout, writes the undrawn state in words, and shows it in the checkpoint's pictures. The boards' sample content looks real; tests and pictures use made up content only.
13. **A preview cannot be signed into** until K sets its sign-in key, so staff pages are shown in pictures or in production.
14. **The place list** needs two public Census files brought in once; if the build's machine cannot fetch them, they are supplied by hand. No request for them names the association or a person.
15. **Photos can show people.** The editor says whose OK is needed, and a keeper can delete at once.
16. **A migration run that lags or fails.** The site's build and the migration run start together. Every path that reads a new table with the switches off catches its absence and goes on, and no merge is finished until the run is green.
17. **A switch turned on out of order.** The order's test fails the change, so it cannot merge; the promise about the email, the public pages in today's look and events ahead of the staff pages are all refused.
18. **The signing secret now guards every public form**, not only the monthly check. Missing, the forms refuse in words; K sets it before `newClubs`.
19. **Volunteers.** Most pages start bare and stay bare. The bare page must read as finished, and the monthly email does the remembering. Nothing in the plan depends on a club answering.

## 12. Where the plan differs from the brief and from the handoff

**From the brief** (the manifest's `deviations_from_brief` lists each with its steps):
1. Two more switches; the representatives' grants follow `REGION_EVENTS_ON`, not `CLUB_PAGES_ON`.
2. A save also writes today's fields while the new pages are off.
3. Today's public club answer is named column by column first; the brief did not see that it sends every column.
4. Six old-address rows, not 25; slugs typed per id. The seed's statements are the board's 18 lines, not the map file's.
5. The route files keep their names; the address part is read as a slug, an old slug or an id.
6. Today's club answer also finds a club by its slug (choice 8).
7. Straight-line miles in the browser, a built-in place list, pins by hand. No road miles, no lookup, no `zip_regions` or `club_distances` table. The page sends a typed place to no server; a ZIP in the page's address reaches LCA's server on a reload, unlogged and unstored.
8. Three shared pieces built here under their owners' names.
9. Reply through LCA's link is sealed, not only signed.
10. Left out for want of a base: Follow, follower emails, Add to calendar, partner events on a club page, the setup checklist's way in, the publish date's refusal, the admin queue.
11. The monthly check and the 14-day clock live in the clubs stream's files, with one line each in the worker.
12. The schema is split across files by first use; the seed is its own file; `club_reports` gains `escalated_at`.
13. The member delete and the club delete are changed; neither is in the brief's list.
14. The new public pages wait for `newLook`.
15. Explaining words sit behind Help. The thin card is one link. One kind of open item.
16. The held parts of P2.18 are not made here.
17. The switches go on in an order a test holds, and Q14's switch comes before the staff switch.
18. The first place's pin is seeded from today's map list, where the brief names the stored columns, which no migration fills (choice 4).
19. By choice 1 (a), a region's representative gets no roster or officer's email on today's admin club page.
20. The numbers start at 0065 where the brief's rule 0.2 says to continue after the highest file; the gap is K's decision 58 in `STREAMS.md`. The generator gains a number option.
21. The limit's bucket is a keyed hash that refuses without the secret. The relay falls to the next keeper when the club's address is refused.
22. The timed check is due on the first Monday only, runs after the mail phases, and writes no row when idle; the no-login link checks the seat when used. WS09 does not wrap the mail stream's send-later phase.
23. A representative's fee refusal is decided by the event's club and holds whether `CREATION_ROLES_ON` is set or not; the brief leans on D24's list, which the code reads only with that switch on. The four approval columns are manager-only in the public tournament answers.
24. The WS01 contrast follow-ups on today's club pages end when `newClubs` goes on with `newLook`; no step mends them in today's look.
25. The new clubs strip does not carry "300+ members"; the figure stays on the home page.
26. Rows with no club have an endpoint of their own, guarded by the row's region. Naming a rep writes the role and the club together; a representative may name only a plain member.
27. Today's `/contact` page sends a spam token once `newClubs` is on. Today's club create checks a new slug against every id, slug and old slug.

On the fee list the plan does not differ from the brief: the brief's line 2126 leaves regional representatives off D24's list, as D24 and the code do, and club reps stay on it.

**From the handoff:**
1. 38 steps, not about 33: the three shared pieces, the guard work and the two held single-line steps add more than the left-out items remove.
2. The staff half is ready about Thursday, December 3, 2026, not Friday, November 27, 2026. It starts with five ground steps, and the build waits for K's first answers.
3. Suggestions and rep requests, and so My region's to-do rows, arrive with the public forms in checkpoint X. A to-do list nothing can fill would be an empty block on the pages K shows the board.
4. Photos sit in the last checkpoint. The five basics need none.
5. The whole workstream merges about Monday, January 4, 2027 (range to Friday, January 15, 2027), where the handoff's roadmap gives Tuesday, November 24 to Tuesday, December 22, 2026, with Thursday, December 10, 2026 at the centre. The reasons are item 1's five more steps, the wait for K's first answers, the mail stream's fence days, and the holidays around K's last looks.

## 13. What was not chosen, and why

- **Starting with the editor in the first checkpoint** (the staff-first outline). Its first migration would have gone out with the editor around it. The ground is read alone first: K's look at checkpoint S is a sheet of data, not a page, and the two risky files merge with nothing else to look at. Cost: the editor is about two days later.
- **Building the page's read and bare page before the editor** (the risk-first outline), so the editor's page preview is drawn once. Not chosen: the search result, the share card and the card preview carry the editor until the page exists, and the page preview is added in step 21 as an addition, not a redo. The editor is what K needs first.
- **Representatives' club events as an optional checkpoint after the public release** (risk first). Not chosen as the default, because it is the one representative's workflow that can be shown live in December with no public page on, and its own switch keeps it dark. It stays movable: choice 6 (b) puts it after Y with no rework.
- **Photos, Reply through LCA and the P2.18 removals as optional extras** (risk first). Not chosen: each is a criterion of the brief, so each is a planned step, placed late. Reply through LCA sits beside the relay, because without it a representative who answers shows their own address, against K's words on trust with volunteers.
- **A fourth switch for the directory alone** (risk first), so club pages could go public about a week before the new directory. Not chosen: one more pair to keep, and one more state of the public site to test (new pages reached from today's directory), for a few days' gain.
- **All three shared pieces in the first checkpoint** (risk first). Not chosen: each is built at its first user, so its shape is proved by a real caller and K's keys are asked for when they are needed.
- **The directory before the club page** (staff first). Not chosen: the club page is what the editor edits, what a search engine reads and where the 301s land; every directory card links to it.
- **A `zip_regions` table filled by a migration** (risk first, and the brief). Not chosen: about 500 rows of public data pushed into production by a migration, then copied again for the browser. One built-in list read by both does the same work.
- **Filling About from today's description for all 25 clubs** (staff first). Not chosen: for 18 clubs the description is the meeting line itself, so the page would say it twice. The brief's rule stands: About is seeded for the seven with no line.
- **Slugs worked out from names in SQL** (staff first). Not chosen: typed values per club id cannot surprise on rows nobody has read.
- **Regions numbered after the schema file** (staff first). Not chosen: the brief ships regions first, and either file can be dropped without moving the other.
- **Waiting for WS06, WS07 and WS08** to build the shared pieces. Not chosen: the monthly check and every form would move months out.
- **Road miles now.** Not chosen: a provider key, a cost, a phase in the held worker and unread terms, for a figure that straight-line miles give well enough in most of the state. It stays K's to add (choice 5).
- **Renaming the page route to `[slug]`** (the brief). Not chosen: two names for one address part cannot sit side by side, logo addresses need the id, and two tests pin today's names.
- **Making `regionEvents` wait for `standingDirectors`**, so the fee list alone would refuse a representative's fee. Not chosen: K's own items hold that switch off for an unknown time, and a refusal that depends on another switch is a refusal waiting to be forgotten. The rule is written to hold in both states.
- **Leaving the club page's read open to everyone under the staff switch**, so a keeper's preview needs no sign-in check. Not chosen: it would publish unreleased pages, with volunteers' names on them, the day K turns the staff switch on.
- **Checkpoint S merging before the mail stream's checkpoint P.** Not chosen: the second to merge regenerates a snapshot and re-pins five sets of counts, and that work belongs with the newer stream, not on the mail stream's fence days.

## 14. What the two reviews changed

Two reviews tried to break the first version of this plan. Every finding was checked against `main` at `af4a21c` and the brief, and every one of substance held. What changed:

1. **The email promise.** The editor said "never shown" while today's club page prints the address. Now `clubEmailHidden` must be on before `clubKeepers` or `newClubs`, a test holds that, and the label follows the switch (steps 2, 7, 9, 38).
2. **Four new tournament columns would have been public.** They are manager-only from the step that adds them (step 16).
3. **A representative could have charged a fee** while `CREATION_ROLES_ON` is off. The refusal now sits ahead of that line, is decided by the event's club, and is tested in both states on a create and on a save (steps 16, 17).
4. **Numbers.** The generator gains a number option; the README says who holds what; S merges after P; the mail stream is told (steps 2 to 5, section 5).
5. **The timed check wrote a row every five minutes.** Idle runs now write nothing and make no query (steps 14, 15, 29).
6. **The pinned tests** a new migration moves are listed in full (seven, not three).
7. **Choice 1** now names all three effects of filling the regions and holds the roster back by default (step 3).
8. **Switch-on.** `newClubs` cannot go on without `newLook`; today's contact page sends a spam token from the switch-on; the signing secret is a need of the public forms (steps 2, 25, 35, 38).
9. **Held files.** The Admin's clubs list is not touched; the check's line runs after the mail phases; the send-later wrapping is left to the mail stream, in words (steps 15, 30).
10. **Naming a rep** is two writes in one batch, limited to plain members, and listed for K (step 31).
11. **Slugs.** A new club's slug cannot clash; a changed slug cannot take another club's address; a club whose id is its slug is never redirected to itself (steps 4, 6, 20, 23).
12. **A lagging migration run** breaks nothing, and no merge is finished until the run is green (section 2).
13. **The page's read under the staff switch** goes to that club's keepers only (step 20).
14. **Smaller points:** the rate limit's keyed hash and its refusal with no secret; the relay's fallback; the no-login link's seat check; the due rule's Monday; rows with no club; the privacy words; the stand-in route gated; the preview bucket a hard precondition; choice 4's look; choice 6's fourth option; the dropped commit-lines choice, replaced by the slug choice; the defaults pointed to from K's copy; the whole workstream's date against the roadmap; six more deviations and one phantom deviation removed.

Not taken as the reviewer wrote it, each with the reason: Contact was not added to step 23's server-written words, because no Contact section exists until step 26, which writes its heading and line with the form and tests them, still before any switch-on. The fee refusal was not tied to `CREATION_ROLES_ON` being on (one reviewer's second option), for the reason in section 13.
