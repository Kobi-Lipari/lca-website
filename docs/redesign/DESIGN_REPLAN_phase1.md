# Phase 1 design replan: the Tournaments list (canvas page 4) and the Tournament page (canvas page 5)

**For:** K (owner) and the engineer building WS04
**Status:** part 1 (the Tournaments list) decided by K on October 8, 2026, in two rounds; part 2 (the Tournament page) decided the same day in two rounds, with the family accounts model accepted and Registration (page 6) decided on the same basis (sections 11 and 12). The build starts with WS01.
**Date:** October 8, 2026
**Companion:** `REDESIGN_SPEC.md` v1.2. Section 5 of this document holds the WS04 text that replaces parts of the brief. Sections 2 and 8 hold the text that replaces parts of the brief; it is applied as version 1.3 together with the Registration (page 6) decisions, so the Phase 1 brief changes land once. Until then this document wins over WS04, WS05, WS06, WS08, WS12 and WS13 where they disagree.

The decided boards are on canvas page 4 ("4 · Tournaments list") and copied into `docs/redesign/decided-boards`: `Tourn-List-Final`, `Tourn-List-States`, `Tourn-Calendar-Final`, `Tourn-Map-Final`, `Tourn-Table-Final` and `Tourn-Phones-Final`. They replace `Tourn-A` to `Tourn-E` and `Tourn-Phones`, and the nine option boards drawn in between.

---

# Part 1: the Tournaments list (canvas page 4)

## 1. What K decided

### Round 1: the list and its views

> "Mix A and B. Remove the State champions and first-tournament links. Keep the Upcoming / Results selector. Remove the LCA-run and Rated filters. The search bar is intentional: view switcher central, search right. A's rows with B's preview; what is on A's right stays until a tournament is selected. A bell on hover for reminders, a week and a day out, sign-in required. The calendar is ugly, more options. Love the map, apply the suggestions and refine it, options. Power table options. Mobile: a simplified map, list and table. [Later:] A calendar is fine on mobile too, give me mobile-friendly options for every view."

**Decisions**
- **One list, four views: List, Calendar, Map and Table.** List is the default. The view switcher sits in the centre of the page band, the Upcoming · Results selector at the left and the tournament search box at the right, on every view.
- **List = A's rows with B's preview.** The month-grouped rows from Tourn-A; at 1280px and wider the right column holds the rail (New to tournaments?, Latest results, For organizers) until a row is selected, when a 400px preview pane takes the rail's place. Closing the preview brings the rail back.
- **The two links under the title are gone.** State champions moves to the top of the Results tab as a card; "Your first tournament, step by step" lives in the rail's New to tournaments card.
- **Filters are When, Type and Region.** The LCA-run (Source) and Rated chips are dropped; the source is shown by a tag on each row (desktop) and by the register wording.
- **Reminders by bell.** Hovering or focusing an LCA row shows a bell; it opens a "Remind me" popover with one week before and one day before ticked by default, plus "before the early price ends" and "when registration opens" where they apply. Signed out, the bell asks for a log in. Partner rows get only the two date reminders. Saved reminders show a filled bell and "Reminders on · 2".
- **Calendar, Map and Table were each drawn three ways** and picked in round 2, below.

### Round 2: K's seven notes on the decided list, and the picks

> "Remove copy link. One uniform filter and sort line: count at the left, sort at the far right, Clear all to the right of the filters and left of sort. The text under the filters becomes a note or info. Minors abbreviated in See who's registered, full for admin and TD. The preview's bottom buttons are good. Calendar option 2, Map option 2, Table option 3 on desktop. Phones: remove the LCA event and Partner event text and the bell on rows, bell only in the preview; List B with a good preview; Map A with a preview and an obvious way back, copy link removed; filters into a Filters button tucked beside something, opening the filter sheet; the view picker becomes a Display dropdown, best judgement; Table A with the desktop notes."

**Decisions, desktop**
- **4.1 No "Copy link to this view" anywhere.** Filter state still lives in the URL, so the address bar is the link. Share stays per event, in the preview.
- **4.2 One filter-and-sort line, 44px:** the live count ("16 tournaments") at the left, then the When, Type and Region dropdowns, then the applied chips, then Clear all, then Sort at the far right ("Sort: Soonest first", also Name A to Z, Closest to me once a region or city is set). Identical on List, Calendar, Map and Table.
- **4.3 An info note, not loose text,** under the line: one muted card with the info icon, saying what is showing and how the two sources register ("Showing Thu, Oct 8 to Wed, Jan 6 · 3 register on LCA · 13 partner listings. LCA events register here. Partner events come from the Gulf South Tournament Clearinghouse and register on the organizer's site, opens in a new tab.").
- **4.4 See who's registered, public view:** entrants under 18 show as first name and last initial ("Priya S."); adults by full name; TDs and admins see full names. Results, standings and winners keep full names (D3). The list is grouped by section with per-section counts.
- **4.5 The preview's button row stands:** Register (gold, with the current price) · Remind me · Add to calendar · Share · Full event page. A partner preview shows "Registers on the organizer's site ↗" in navy in place of Register, no count, and no sections table. An LCA event not yet open leads with "Remind me when it opens", then Add to calendar, Share and Full event page, and gains Register when registration opens.
- **4.6 Calendar: option 2, Month beside the list.** A small Monday-first month at the left (LCA days filled, partner days hollow, today ringed, multi-day events as one bar), the week-grouped list beside it, tapping a day scrolls the list to that day; the same preview pane as the List.
- **4.6 Map: option 2, Map first, list drawer.** The map across the full width (filled pins for LCA events, hollow for partner, clusters with counts, region labels), a list drawer below it kept in sync with the pins, and the preview inside the drawer with the full button row. Selecting a pin highlights the row and the other way round.
- **4.6 Table: option 3, Compact table with a side panel.** Dense 13px rows (Date, Event, City, Type, Source, Entries, Status), Date and Event frozen when the table scrolls sideways, sortable column headers, the picked row with a gold ring opening the same preview as a side panel, and the List's button row at the bottom of the panel. No bell column: Remind me lives in the panel. Below 1280px the panel becomes a 400px drawer over the right edge.

**Decisions, phones**
- **List B** (rows with a sticky month band and the live count) with a full preview sheet.
- **Map A** (map on top, list sheet below that drags up) with the pin preview rising over the lower half and "‹ Back to map" as the first thing under the thumb. No copy link.
- **Table A** (Date and Event frozen, swipe for the rest) without the bell column and tag text; partner rows say "Organizer's site ↗".
- **Calendar A** (month grid over the selected day's agenda) is drawn as the default because it matches the desktop pick; K can swap it for B or C with one word.
- **One toolbar on every view, two rows:** Upcoming · Results on the first row; a **Display** dropdown (List · Calendar · Map · Table, a tick on the current one) at the left of the second row, the live count beside it, and a **Filters** button with the applied count ("Filters · 2") at the right, which opens the filter sheet (When, Type, Region with counts, Clear all, "Show 16 events"). No chip row on phones. Search stays in the app bar.
- **Rows carry no LCA or Partner tag text and no bell.** The navy date block and the status words mark LCA events; partner rows read "Registers on the organizer's site ↗". The bell lives only in the preview's Remind me, which opens the reminders sheet with one week and one day before ticked.
- **One preview sheet** for all four views: "‹ Back to list" (or map, table, calendar) as a 44px pill at the top left, Close at the top right, the same facts, sections and fees as desktop, See who's registered with minors abbreviated, and the full button row pinned at the bottom.

**How the ambiguous phrases were read**
- "What is on A's right stays until a tournament is selected" was read as the rail and the preview sharing one 400px column, never both at once; Close on the preview restores the rail.
- "Sign-in required" for the bell was read as: signed out, the bell still appears on hover and opens a small "Log in to set reminders" card, so the feature is discoverable; nothing is saved without an account. Reminders go by email, to the account's address, with a line in My LCA to change or stop them.
- "Tucked beside something" for the phone Filters button was read as beside the live count, at the right of the Display row, so the two controls that change what the list shows sit on one row.
- "Display dropdown, best judgement" was read as a plain select-style button with a sheet of four options, not a segmented control, so it fits beside the count and the Filters button at 390px.
- "Table A with the desktop notes" was read as: the phone table takes 4.1 to 4.5 (no copy link, info note folded into the Filters sheet, minors abbreviated, the preview's buttons), with the bell column removed as on desktop.
- The Results tab keeps the Upcoming · Results selector but shows a season switcher (2026 · 2025 · 2024 · Earlier) in the centre where the view switcher would be, since Calendar, Map and Table do not apply to past results. The chrome is otherwise identical.

---

## 2. Where it lands in WS04

These are the changes to `REDESIGN_SPEC.md` WS04 ("Event discovery & sharing"), ready to paste when version 1.3 is cut. Line references are to v1.2.

### 2.1 Canvas boards (replaces the "Canvas boards" list)
- `Tourn-List-Final` is the default List view with the rail and the preview pane; `Tourn-List-States` holds the Results tab and the bell's signed-out, partner and saved states.
- `Tourn-Calendar-Final` is the calendar view (month beside the list).
- `Tourn-Map-Final` is the map view (map first, list drawer).
- `Tourn-Table-Final` is the table view (compact table, side panel).
- `Tourn-Phones-Final` covers every phone layout.
- `Event-E` stays the partner page until page 5 is decided.

### 2.2 User-facing scope (replaces the matching bullets)
- **One list, four views.** `/tournaments?view=list|calendar|map|table`; `list` is the default and is omitted from the URL. The page band holds Upcoming · Results at the left, the view switcher in the centre and the tournament search box at the right. On the Results tab the centre holds the season switcher instead.
  - **List:** month-grouped rows, each with a weekday date block, name, city and organizer, type, "23 of 60 registered" with a fill bar and the next price step on LCA rows, status in words; partner rows are lighter and say "Registers on the organizer's site ↗". On hover or focus an LCA row shows the Remind me bell. At 1280px and wider the right column is the rail (New to tournaments?, Latest results, For organizers) until a row is selected.
  - **Calendar:** a small Monday-first month beside the week-grouped list; LCA days filled, partner days hollow, today ringed, multi-day events as one bar; tapping a day scrolls the list; the grid works with arrow keys and has a text alternative.
  - **Map:** `LCAMap` across the full width with filled pins for LCA events, hollow pins for partners, clusters with counts and region labels, and a list drawer below kept in sync with the pins. Distance from a city or ZIP comes later.
  - **Table:** sortable, Date and Event frozen, Entries as "23 of 60" with a mini bar, Status in words; no bell column; a picked row opens the preview as a side panel, a drawer below 1280px. Saved views for signed-in users are not on the decided board (open question 4).
- **One filter-and-sort line** on every view: the live count, then **When** (This weekend · Next 30 days · Next 3 months · Any time · Pick dates) · **Type** (Classical · Quick · Blitz · Scholastic · FIDE) · **Region** (Louisiana + nearby states by default; Louisiana's seven regions; Mississippi, Texas, Alabama), then the applied chips (removable), Clear all, and Sort at the far right (Soonest first · Name A to Z · Closest to me). The Rated and Source chips are dropped. All state lives in the URL, so back and forward restore it and the address bar is the link; there is no "Copy link to this view" control. Under the line, one muted info note says what is showing and how each source registers. On phones the chips become a Filters button with the applied count beside the live count; it opens a bottom sheet with "Show 16 events".
- **Preview pane** (at 1280px and wider on List and Calendar; inside the drawer on Map; the side panel on Table): the facts, sections and fees, See who's registered (public: under-18s as first name and last initial, adults in full; TDs and admins in full), then Register (gold, with the current price) · Remind me · Add to calendar · Share · Full event page. Partner events show "Registers on the organizer's site ↗" in navy, never Register and never a count. An LCA event not yet open leads with "Remind me when it opens". The preview replaces the rail; Close brings the rail back.
- **Reminders** (`tournament_reminders`, extended): the bell on an LCA row, and Remind me in every preview, open a popover (a sheet on phones) with "One week before" and "One day before" ticked by default, plus "Before the early price ends" and "When registration opens" where they apply; partner events offer only the two date reminders. Signed out, the bell opens "Log in to set reminders". Saved reminders show a filled bell with "Reminders on · 2" and a saved toast. Reminders go by email and can be changed or stopped in My LCA. Keep today's "Notify me when registration opens" as the "When registration opens" option.
- **Phones:** the two-row toolbar (Upcoming · Results; Display dropdown, live count, Filters button), List B rows with a sticky month band and no tag text or bells, one preview sheet with "‹ Back to <view>" and the pinned button row, Map A with the list sheet and pin preview, Table A with frozen Date and Event, and Calendar A (month grid over the day's agenda) by default.

### 2.3 Data model and API, additions
- `tournament_reminders` gains `kind TEXT NOT NULL CHECK (kind IN ('opens','early_price','week_before','day_before'))` (verify: the current table and its unique index first; today's rows are `opens`), and the clearinghouse id for partner reminders (verify: whether `tournament_reminders.tournament_id` can reference `clearinghouse` rows or needs a `source` column).
- `GET`, `POST` and `DELETE /api/me/reminders` (new; `requireAuthedMember`) list, save and remove a member's reminders per event; the bell's popover saves all ticked kinds in one call.
- `GET /api/events` adds `sort=soonest|name|distance` and the `view`-independent filters above (`when`, `type`, `region`); `rated` and `source` are dropped from the API's public filters (the merge keeps `source` in every row).
- `GET /api/events/:id/entrants` (new, public): per-section entrant names for an LCA event, minors as first name and last initial, adults by full name, with a `full=1` variant for `requireTournamentView`. Returns nothing for partner events.
- `workers/daily-emails` sends the week-before and day-before reminders; the existing opens-reminder path handles `opens`; an early-price reminder goes the day before `next_price_change`.

### 2.4 Frontend, changes to the lists
- New: `src/components/events/FilterBar.tsx` (the one line: count, dropdowns, chips, Clear all, Sort), `InfoNote.tsx`, `RemindMePopover.tsx` (popover on desktop, sheet on phones), `EntrantsList.tsx`, `DisplayMenu.tsx` (the phone Display dropdown), `Rail.tsx` (New to tournaments?, Latest results, For organizers).
- `ViewSwitcher.tsx` renders the centre segmented control on desktop and hands off to `DisplayMenu.tsx` under 768px.
- `PreviewPane.tsx` renders as the pane, the drawer, the side panel or the phone sheet from one component; it owns the button row so the partner and not-open variants cannot show Register.
- `EventRow.tsx` carries no tag text or bell under 768px.

### 2.5 Acceptance criteria, changes and additions
1. `/tournaments` opens in List view, grouped by month, with weekday dates; the page band shows Upcoming · Results, the view switcher and the search box in that order; every filter, sort and view change updates the URL and back/forward restores it. There is no Copy link control.
2. The filter-and-sort line reads count, When, Type, Region, applied chips, Clear all, Sort, in that order, on all four views, at 1024px and 1440px; "Clear all" restores the full list; the info note under it names the date range and the count by source.
9. Selecting a row at 1280px replaces the rail with the preview pane and Close restores the rail; the pane's buttons read Register · Remind me · Add to calendar · Share · Full event page for an open LCA event, lead with "Remind me when it opens" for one not yet open, and show "Registers on the organizer's site ↗" with no count for a partner event.
10. The bell appears on hover and focus of an LCA row (and never on phones), opens the Remind me popover with one week and one day before ticked, asks for a log in when signed out, offers only the two date reminders for a partner event, and shows "Reminders on · N" once saved. Saved reminders appear in My LCA.
11. The public entrants list shows under-18s as first name and last initial and adults in full, grouped by section with counts; a TD or admin sees full names; a partner event has no entrants list.
12. Under 768px the toolbar shows Upcoming · Results, then Display, the live count and Filters · N; Display lists the four views with the current one ticked; Filters opens the sheet with counts and "Show N events"; rows show no tag text and no bell; the preview sheet opens from a row, a pin, a table row and a calendar day with "‹ Back to <view>" at the top left and the button row pinned at the bottom.
13. Table view has no bell column; Date and Event stay frozen when the table scrolls sideways; a picked row carries a gold ring and opens the side panel; below 1280px the panel is a drawer that Esc or Close shuts.

Criteria 3 to 8 stand.

### 2.6 Tests, additions
- Integration: `/api/me/reminders` (save all kinds, partner events accept only date kinds, signed out is 401), `/api/events/:id/entrants` (minors abbreviated, `full=1` only for `requireTournamentView`, partner events empty).
- Unit: `eventFilters` round-trip including `sort` and `view`; the entrant display-name helper (under 18 → first name and last initial).

---

## 3. Questions for K

Each has a default in bold; silence keeps the default.

1. **Phone calendar:** Calendar A (month grid over the day's agenda) is drawn as the default because it matches the desktop pick. **Keep A**, or say B or C.
2. **CSV export for directors:** it was dropped from the table view with the bell column. **It moves to the TD tools (WS08), where the entrants list already lives**, or it comes back as a link in the table footer for `requireTournamentView` only.
3. **Map defaults:** "Update the list as I move the map" **starts ticked**; the map **opens on the Gulf South** when the Region filter is at its default and zooms to Louisiana when a Louisiana region is picked.
4. **Saved table views** for signed-in users (brief, WS04 scope) are not on the decided board. **Drop them from WS04**; the URL already holds every view, and a saved search (weekly email) covers the recurring case.
5. **The `.ics` Subscribe link** for the current filters is not drawn. **It goes at the end of the info note** ("Subscribe to this list"), on every view.
6. **The not-yet-open LCA preview** leads with "Remind me when it opens" and gains Register when registration opens, which departs from the fixed Register-first order. **Keep it**; there is nothing to register for until then.

---

## 4. Board index for page 4

| Board | Size | What it shows | Replaces |
|---|---|---|---|
| `Tourn-List-Final` | 1440 × 6450 | Frame A, the default List with the rail and the bell popover; frame B with the preview pane, and the partner and not-open panes | `Tourn-A`, `Tourn-B` |
| `Tourn-List-States` | 1440 × 3000 | Frame C, the Results tab with the State champions card; frame D, the bell signed out, on a partner event and after saving | (continues the above) |
| `Tourn-Calendar-Final` | 1440 × 3400 | Month beside the list, with the preview | `Tourn-C`, options 1 to 3 |
| `Tourn-Map-Final` | 1440 × 4500 | Map first, list drawer, drawer preview | `Tourn-D`, options 1 to 3 |
| `Tourn-Table-Final` | 1440 × 3550 | Compact table, side panel, other states, the drawer below 1280px | `Tourn-E`, options 1 to 3 |
| `Tourn-Phones-Final` | 2800 × 4100 | Thirteen phone frames (List 6, Map 3, Table 2, Calendar 2) and the pieces every view shares | `Tourn-Phones`, the phone options board |

Every board carries a title strip ("Built from", "Replaces", "K's feedback applied"), a numbered legend and a "K's feedback, and where it landed" checklist with items 4.1 to 4.7 as tick boxes. Sample data (entry and section counts, which events register on LCA, type counts, entrant names) is badged; event names, dates, cities and organizers are real, from the Gulf South feed.

---

# Part 2: the Tournament page (canvas page 5)

**Status:** decided by K on October 8, 2026, with one unified page drawn for sign-off. The family accounts model in section 7 is a recommendation for K.

The decided boards are on canvas page 5 ("5 · Tournament page") and copied into `docs/redesign/decided-boards`: `Event-Final-1`, `Event-Final-2`, `Event-Final-States`, `Event-Final-Family`, `Event-Final-Setup`, `Event-Partner-Final`, `Event-Festival-Final` and `Event-Phones-Final`. They replace `Event-A` to `Event-E` and `Event-Phones`.

## 5. What K decided

> "Tournament entry can be limited entry overall (default) or by section … there should also be an option in the tournament creation for the TD to apply section limits, then the overall cap would be the sum of the section limits, or still the overall one if they fill that in too, and then if they select a certain section to view it should show the entry amount and section entry cap … if the TD doesn't put in a early or late registration entry fee options, dont show them in the registration card, just the regular … only show the register my family button if they have a LCA family membership or are not logged in … let them confirm their family member list … a picker in their family list to let them pick which of their family members will be attending, which section they will be in and apply the added entry fees as normal (only the LCA membership is bundled …) … pay the combined total on behalf of their family … I like E and how it handled the limited information … this uses a man made excel sheet, be sure to prepare for human error … I really really like D … keep this available or make it creatable by admins for when we have big events … show it at the top thing of the main page … a button to go live with the page, and also enable or disable the featuring … I really really like B and how it handles the display of schedule options … available to enable, disable, and manage in the tournament creation page. Same thing for the side events block … I like B overall, but be sure it can operate as more than just a championship hub … I like the sub nav bar in B … the display we use should be determined by the options of the tournament setup … if it doesn't [have multiple schedules] I prefer A's layout … keep past champions in a navbar and not shown at the bottom … I like B's layout for the top better. But I like A's layout for the registration sidebar better … I like the share and ask the td buttons there. I like the hotel and travel side bar thing and maybe it should also be on the bottom … (if the td enables this …) … I love the link preview thing on the sidebar … only put that round alerts side bar when a person is registered … don't show that notifs on this phone option since you said we can't do sms … I prefer the who's coming block of A, but do not associate players with clubs … I really like that good to know section at the bottom. Maybe we get a unified vision for this with only one unified option … The phone stuff here looks fine, should pay attention to the changes that we are applying to the desktop version."

**Decisions**
- **One tournament page.** The brief's `standard` and `championship` layouts merge into one template whose blocks and forms follow the event's setup. The `layout` column goes; `display_state` (the TD override) stays; a sub nav on every event replaces `ChampionshipTabs`.
- **Top and sub nav from B; registration card, who's coming and good to know from A.** The top is B's navy band with the key-facts card (days to Round 1, the fill bar, Register · from $X, Remind me). The sub nav is B's sticky row (Overview · Sections & prizes · Schedule · Who's coming · Venue & travel · Good to know · Past champions ↗ · Pairings · Standings), addressed by hash. The sidebar card is A's (section picker, the fee ladder with dates, member price, You pay today, Register, Register my family, Calendar · Share · Ask the TD).
- **The setup picks the form of sections and schedule.** With one schedule: A's section cards, then schedule and prizes side by side. With two schedules that merge: B's day-by-day schedule (rows tagged 3-day or 2-day, the merge row), then B's sections and prizes.
- **Entry limits are overall (the default) or by section.** By section, the overall shown is the TD's number if entered, else the sum of the caps; a picked section shows its own count and cap; an uncapped section shows "N entered"; with no limit at all the page shows "38 registered" and no bar. Both limits are enforced at checkout and the waitlist is per section when limits are by section.
- **Fee tiers only when set.** Regular is required; Early and Late are optional; the card shows one line "Entry fee $50" when only Regular exists. Most events keep the ladder.
- **Register my family** appears for a signed-out viewer (to advertise the Family membership, with an explainer sheet) and for a signed-in member with an active Family membership. Nobody else sees it; other guardians add children inside the main Register flow as today. The picker lets the guardian confirm who is playing and how each name will appear, pick an eligible section (or side event) per person with that section's member price, choose a schedule where there are two, and pay once. Only the membership is shared; every player pays their own entry fee.
- **Past champions** is a sub nav link to the honor roll for the event's championship title, never a block at the bottom.
- **Hotel & travel** is a setup option: a sidebar block and, when on, a fuller travel section inside Venue & travel. **Side events** and **a second schedule with a merge round** are setup options too, on or off per event and editable after creation.
- **Round alerts** show only to a registered player or the guardian of one, by email only. There is no SMS and no phone-notification toggle.
- **Who's coming** is A's rating-sorted table with section filters, with no club column anywhere. Under-18s show as first name and last initial publicly, as on page 4.
- **The link preview** stays in the sidebar, with Copy link, Share to Facebook and QR code under it (the event's own link, not a filtered view).
- **The partner page** keeps E's shape and gains rules for every way a hand-kept spreadsheet can be wrong or late (section 8.6).
- **The festival page** stays as an admin-created page (its own `festivals` table, Go live, Take offline, Feature on the home page), and the home hero gains an admin-pinned Featured rung so a featured festival can lead the home page.
- **Phones** take every desktop change: the inline card under the title, chips for sections and schedules, the single-fee bar, no club lines, the registered sheet with the email switch only, Register my family on a phone.

## 6. How the ambiguous phrases were read
- "The overall cap would be the sum of the section limits, or still the overall one if they fill that in too" was read as: the TD's own overall number wins when entered; otherwise the page sums the caps; a section the TD left blank is uncapped and counts toward no sum, so with any blank cap and no overall number the page shows the entered total with no cap.
- "If they select a certain section to view" was read as the section picker in the sidebar card (and the chips on phones): picking one changes the count line to that section's count and cap, with the overall in a smaller second line.
- "Only show the register my family button if they have a LCA family membership or are not logged in" was read literally, including the exclusion of signed-in Adult, Scholastic and Senior members and of an expired Family membership. A Family member with no dependents yet sees "Add your family first ›" instead.
- "Each person still needs to pay the entry fee … different based on type of section" was read as: the picker prices each person by the section or side event they pick, at the member price, because the Family membership covers them. Scholastic side events are listed in the same select, so a child can be placed in the Scholastic from the picker.
- "Make sure this kind of schedule options and merging is available to enable, disable, and manage in the tournament creation page" was read as a Schedules step in WS08's setup checklist, off by default, holding a second schedule and the merge round, with the player's choice stored on the registration.
- "Be sure it can operate as … a general tournament page screen" was read as: the tag reads "Club event" and the organizer line names the club or organizer and its TD for events LCA does not run; the member-discount line appears only when the setup has a member price.
- "Prepare for human error" on the partner page was read as a fixed facts card that never hides a row (blank rows read "Not in the listing yet"), with rules for a missing venue or city, an unconfirmed date, a missing or bare link, a stale sync, a listing that left the feed, a changed date and a probable duplicate.
- "Show it at the top thing of the main page … enable or disable the featuring" was read as a Featured rung in the hero ladder that an admin pins from the festival panel: one festival at a time, only while the page is live, until the festival's end date, cleared by Take offline. The rung sits after Live and Event day, except that when the live or event-day event belongs to the featured festival the festival hero stays and carries the live line (question 9.3).
- "Maybe we don't show that notifs on this phone option" was read as: drop the phone-notification toggle everywhere; alerts are email only until WS07 adds anything else.
- "Only put that round alerts side bar when a person is registered" was read to include the guardian of a registered dependent, with one switch per registered person, sent to the guardian's address.
- B's countdown was kept as a plain days figure that changes once a day; nothing ticks.
- "From $X" on viewer-neutral surfaces (the top card signed out, the link preview, the phone bar signed out) is the lowest non-member price today across sections; a signed-in member's own surfaces show their price for the picked section.

## 7. Family accounts: one player, one profile

K asked whether LCA should force an email per family member at membership payment, or create each child as a profile linked to the family that a parent can act for and the child can claim later. Three approaches were worked through from different angles (the parent who pays, the child who grows up, the volunteers and TDs), weighed against each other, and merged into the model below. The data facts it builds on: children are already `members` rows with `guardian_id`, no login and the parent's email; the Family tier is held by the guardian and copied onto the first three children.

### 7.1 The recommendation, in K's terms

Your instinct is right: make each child a profile linked to their family, not an account that needs an email. We recommend one player profile per person, for life. A child's profile is made from a first and last name (plus a US Chess ID if they have one) and linked to you as guardian. You register, pay and get every email for them from your own login. Being linked to you is also what tells your Maya Robichaux apart from any other.

From your first idea (an email for each member) we keep the goal of every person having their own email and login, but it is optional and comes later. When a child is 13 or older, you tap "Give Maya her own login" and type her email. She sets her password and gets the same profile, with all her results already there. Asking for emails at payment would add work to checkout, get typos and repeated parent addresses back, and collect email from young children that LCA doesn't need.

From your second idea (switching into a child's account) we keep seeing exactly what the child sees. "Open Maya's page" shows her entries, pairings, results and reminders, but under your login, with your other children alongside. There is nothing to switch back, and payments are never made from the wrong account.

Your button rule and the name confirmation are kept exactly as you described them.

### 7.2 The model

Identity. Each person who plays has exactly one player profile. It is a `members` row, and its id never changes. Children keep `child-<uuid>`, and adults keep their Supabase id. Registrations, payments, pairings, rating at entry, results, reminders and the card QR all point at that id, so nothing moves when a login is added or a guardian changes. A profile is identified in this order: by its US Chess ID when it has one (unique across non-guest profiles), then by its full name plus its household (TDs see "Robichaux family · Danielle Robichaux"), then by the per-profile QR on the digital card. Email is not part of a player's identity. It belongs to a login.

Logins. A login is a key attached to a profile through `members.auth_user_id`. Adults need no change: when `auth_user_id` is empty, sign-in falls back to today's rule, where the member id equals the Supabase id. A child has no login until a guardian gives her one. That is offered only after the guardian ticks "Maya is 13 or older", and the consent is saved with a timestamp. Maya sets her own password from the invite, and her existing row gets the login. A guardian can remove the login while she is under 18, and her history stays.

Guardians. `member_guardians` links a profile to every adult who can act for it. One link is the owner, which is also kept in `members.guardian_id` so today's queries keep working. The other links are guardians, each with their own login. Links are never deleted. They end with a date and a reason (left, removed, handed over, turned 18), so there is a record if households disagree. The owner can invite or remove guardians and hand ownership to another guardian. A guardian can leave. The last active guardian of a child with no login cannot leave. Co-guardians see each other as first name and last initial.

Duplicates with no volunteer work. A request to be added as a guardian never confirms that a named child exists. It answers "Request sent", goes to the owner, and is never granted automatically. A US Chess ID already on LCA blocks a second profile and offers the request instead. History moves between two rows only when they are provably the same person: the names match, the US Chess IDs don't conflict, the row being absorbed has no children or staff roles, and the two rows are not both entered in the same event. Every move is written to `profile_moves`, so a developer can reverse it. An empty self-made row is simply absorbed. Anything else is refused with a plain message and never goes into a volunteer queue.

Family plan. On each guardian link, the guardian ticks which children their plan covers (`family_covered`), up to 3. The ticks are chosen at purchase and at renewal, and an open spot can be filled at any time. With two households, each guardian's plan can cover the child, and the later expiry wins, as it does today. A fourth child is offered Scholastic $5 in the same checkout.

Notifications. One helper decides who gets each email: the player's own login email if she has one, plus every active guardian who has copies on. A guardian's address is read live from their own row. While a child has no login, at least one guardian must keep copies on. Mail is grouped per address, so a parent of three gets one email per send. Receipts go only to the payer. If a teen's address bounces, her mail goes to her guardians.

Display and data minimum. On the pre-event entrants list, a player shows as first name and last initial while any guardian link is active, or when their entry ticks a scholastic eligibility box. Pairings, standings, results and winners show full names. LCA stores no birthdate, grade or age, and no child email unless the child takes a login at 13 or older. Eligibility ("In 8th grade or below?") is asked on each entry and saved in `registrations.eligibility_json`, never on the profile.

### 7.3 The flows

**Add a child.** My LCA > Family > "Add a child" (also inline in step 1 of the household checkout). Fields: First name, Last name, US Chess ID (optional) with "Look up by name" (existing /api/uscf/lookup), which shows the US Chess spelling ("US Chess has: ROBICHAUX, LEO · Use this spelling"). No email, grade or birthday. Helper under the form: "Leo gets his own player profile. He doesn't need an email. You can give him his own login when he is 13 or older." Button: "Add to the family". The line under the button shows the plan spot ("Uses the last child spot on your Family plan" or "Your Family plan covers 3 children. Leo can join for Scholastic $5"). Server: POST /api/me/children inserts the members row as today plus one member_guardians row (kind 'owner', family_covered 1 if a spot is open). Duplicates: a name already in this family returns 409 as today ("You already have a Leo Robichaux in your family"). A US Chess ID that is already on a non-guest profile creates nothing and says: "This US Chess ID is already on an LCA player profile. If this is your child, ask to be added as a guardian. The family that added it can approve you." Button: "Send request". After sending, the parent sees only "Request sent". A matching name with no ID gives no prompt and reveals nothing. A US Chess ID that matches a walk-in guest row becomes this child only when that guest entry's payer email is the parent's own signed-in email. Otherwise the guest row is left alone (see the walk-in flow). The child card appears with "No login · emails come to you".

**Buy a Family membership.** /membership > "Which one fits you?" > "Me and my children". The household optimizer (WS12) shows the math ("Family only saves with three children"). Choose Family $25 > screen "Who's covered?": the parent's own line (fixed), each saved child with a checkbox "Covered by this plan" (the first 3 ticked, a 4th tick disabled with "Family covers you and 3 children"), and an inline "Add a child" (same fields as above). An unticked child shows "Not covered · Add Scholastic for $5" as a line in the same payment. No child email is asked for. Note: "Children don't need an email. Everything comes to you. Each child can get their own login at 13 or older from My LCA." Pay on Stripe. Webhook: activates the guardian, writes family_covered on the ticked links, runs syncFamilyCoverage. Success page: "Covered through Sun, Oct 10, 2027: Danielle, Maya, Leo. One open spot." Each name appears as it will print on entry lists, with a "Fix a spelling" link, plus buttons "Register my family for an event" and "Go to My LCA". Ticks can change only at renewal, but an open spot can be filled at any time. The renewal reminder lists the covered children and flags anyone who now manages their own profile.

**Register my family from an event page.** Button visibility follows K's rule exactly. "Register my family" shows to signed-out visitors and to signed-in people with an active Family membership, either their own or one held by another guardian that covers a child they guard. Everyone else sees "Register", whose step 1 still lists their saved children, so no parent is stranded. Signed out: the button opens a sheet, "How family registration works", with a sample Robichaux picker. Buttons: "Get a Family membership" and "Start: create your login". That second path creates the parent's login (name and email) and the first child in one form, then continues to the picker with no separate sign-up page. Signed in: /tournaments/:id/register (WS06 household checkout) opens on the "Who's playing?" picker, where you choose who is playing and their sections, and confirm names. Then: Byes > US Chess check > LCA membership (only if someone isn't covered) > Check your answers (one line per player at the price paid after the member discount, one total, no card processing line, per D2) > "Pay $X". One registration_orders row with payer_member_id set to the signed-in guardian, and one registrations row per player (player_kind 'dependent' for children), with eligibility_json saved per entry. Confirmation: one card per player with its own Withdraw link, and one grouped email per recipient. More than 9 players: "One order holds up to 9 players. Pay for these 9, then start a second order for the rest."

**How a parent sees a child's pairings, results and reminders.** There is no account switching. My LCA > Family: one card per child (next event, section, paid status, US Chess ID status and expiry, Family plan coverage, last result) and filter chips "Everyone · Maya · Leo". Each card has "Open Maya's page", which goes to /me/players/:memberId. That is the same component Maya sees on her own login (entries, byes, pairings, results history, reminders, card QR), with a strip reading "Maya Robichaux · you manage this profile". On event days the Family day view shows each child's round, board, color, opponent and result side by side, using GET /api/me/event-mode players[] read from member_guardians. On the event page, the WS07 "My players" strip reads "Maya: Board 4, White · Leo: Board 12, Black", and myRegistration widens to cover everyone the viewer acts for. Reminder and round-alert choices are set per child on Maya's page and owned by the parent.

**How a child later gets her own login.** Child card > "Give Maya her own login". Sheet: field "Maya's email", a required checkbox "Maya is 13 or older", and a required checkbox "I'm Maya's parent or guardian and I agree she can have her own LCA login". Both checkboxes are saved with a timestamp, and no age is stored. Button: "Send Maya an invite". There is also "Copy invite link", so a parent can text it. Maya gets "Danielle set up your LCA login" with the button "Set my password" (single use, valid 14 days). On accept: if her email has no LCA login yet, she creates one and auth_user_id is set on her existing row. If her email already has a login with no registrations or payments, that empty row is absorbed. If it has history, LCA checks it is the same person (names match, US Chess IDs not different, the other row has no children and no TD, admin or board role, and the two are not entered in the same event). If so, she sees "Move your 4 past events onto this profile" with a Confirm button, and the move is logged in profile_moves. If not, she sees "This email already belongs to a different LCA player. Use another email", and nothing changes. members.email becomes her address and claimed_at is set. The card then reads "Maya has her own login · since Sat, Oct 10" and shows a "Send me copies" toggle (on by default) and "Remove Maya's login".

**A teen with her own login.** She signs in to her own My LCA: her entries, pairings, results, reminders and card. She can register herself. At "Check your answers" she chooses "Pay now" or "Ask my guardian to pay". The second choice creates an unpaid held entry that shows as rank 1 in each guardian's Needs attention: "Unpaid entry: Maya, The Baton Rouge Classic, U1400, $20 · Pay". A guardian pays in one tap. She cannot add children, remove guardians or see guardians' receipts, card details or siblings' profiles. If a guardian has already entered her, her own attempt is blocked with "Already registered by Danielle R. for U1400".

**A second guardian and two households.** Family > "Guardians" > "Invite a guardian". Fields: their email, and checkboxes for which children (all ticked by default). Button: "Send invite". The invitee signs in or creates a login, then taps "Accept". That adds a member_guardians row (kind 'guardian') per child. They can register, pay with their own card, see the day view and get their own copies, and they can tick their own Family plan to cover the child (the later expiry wins). The other route in is "Send request" from Add a child. The owner gets "A parent or guardian asks to be added for Leo. Approve / Decline", and the requester sees only "Request sent". On approval, if the requester had made a duplicate profile, the same-person check offers "Move Leo's 2 entries onto this profile". In the "Who's playing?" picker, a child already entered by another guardian is locked: "Already registered by Marc R. for K-8". The owner can remove a guardian (ended_reason 'removed') or hand over ownership. A guardian can leave. The last active guardian of a child with no login is blocked: "Invite another guardian or give Leo his own login first." If the owner closes their login, the longest-standing guardian becomes owner. keep_apart 'family' means sharing any active guardian.

**Turning 18.** LCA never stores a birthday, so a person makes the change. The owner can tap "Maya is 18: hand over her profile" on her card, which takes effect at once (ended_reason 'handed_over'). Maya can tap "I'm 18 or older: manage my profile myself" in Settings. That takes effect after 7 days, and her guardians are emailed at once with a "This isn't right" link. If any guardian cancels, a second request needs the owner's approval. Either route requires her own login first, so the button reads "Give Maya her own login first" until she has one. On release, every guardian link gets an ended_at date, guardian_id is set to NULL, and coverage already paid runs to its expiry. Her Family spot opens at the next renewal, where she is shown as "Maya now manages her own profile · Adult $15". Guardians get one email: "Maya now manages her own LCA profile." From then on her full name shows on entrants lists and email goes only to her.

**A TD looking up a child with a common name.** TD console > Check-in. A single search field, "Name, US Chess ID or parent's name". Typing "jayden w" lists rows showing full name, section, rating, US Chess ID ending, "Williams family · Keisha Williams" (the owner, shown only in the console behind requireTournamentManager) and club. Searching a parent's name lists their children. Tap "Check in" on the right row. If siblings are in the event and not checked in, the row offers "Check in all 3 from this family". Scanning the per-profile card QR (WS12) finds the exact row with no typing. "Email guardian" sends through LCA without showing the address. "Add a player" at the door asks for the US Chess ID first, so an existing profile is found and not created twice. Name fixes after check-in are made here, because a parent's "Edit name" locks once the child is checked in to a running event.

**A walk-in child becomes a profile.** A TD adds a walk-in as a guest (role 'guest'), as today. The payer gets "Save these details, create an account". Accepting it while signed in as that payer turns the guest row into a managed child (role 'member', guardian_id set, owner link added), so the results stay attached and no merge is needed. Typing that child's US Chess ID in Add a child converts the guest row only when the guest entry's payer email matches the signed-in parent's email. Anyone else gets a new profile, and the guest row is left alone, so a public US Chess ID can never be used to take over someone else's record.

**Notifications routing.** One helper, recipientsFor(db, memberId) in functions/utils/recipients.ts, is used by registration confirmations, tournament_reminders, tournament_attendee_reminders, WS07 round alerts, waitlist offers, US Chess expiry warnings and renewals. A child with no login: every active guardian with send_copies on. The last such guardian's toggle is disabled with "Someone has to get Leo's emails until he has his own login." A claimed child: her own email plus every guardian with copies on. Released or adult: the player only. Guardian addresses are read live from the guardian's own row. Addresses are de-duplicated and grouped per recipient. A parent of two gets one round email, subject "Round 3 pairings: Maya, Leo", with each line starting with the child's name ("Maya: Round 3, Board 4, White vs Elise Fontenot"). Receipts and refunds go only to registration_orders.payer_email. If a teen's address bounces, her mail goes to her guardians and her card shows "Maya's email isn't receiving mail · Update". Texts follow the same rule when SMS exists.

### 7.4 Data and code changes

Migration migrations/0052_player_profiles.sql (all additive, no members rebuild):
1. ALTER TABLE members ADD COLUMN auth_user_id TEXT; CREATE UNIQUE INDEX idx_members_auth_user ON members(auth_user_id) WHERE auth_user_id IS NOT NULL; No backfill for adults. ALTER TABLE members ADD COLUMN claimed_at TEXT;
2. CREATE TABLE member_guardians (id INTEGER PRIMARY KEY AUTOINCREMENT, member_id TEXT NOT NULL REFERENCES members(id), guardian_member_id TEXT NOT NULL REFERENCES members(id), kind TEXT NOT NULL DEFAULT 'guardian' CHECK (kind IN ('owner','guardian')), send_copies INTEGER NOT NULL DEFAULT 1, family_covered INTEGER NOT NULL DEFAULT 0, added_by TEXT REFERENCES members(id), added_at TEXT NOT NULL DEFAULT (datetime('now')), ended_at TEXT, ended_reason TEXT CHECK (ended_reason IN ('left','removed','handed_over','turned_18'))); unique index on (member_id, guardian_member_id) WHERE ended_at IS NULL; index on guardian_member_id. Backfill one 'owner' row per members row with guardian_id IS NOT NULL. Set family_covered = 1 where fewer than 3 siblings (same guardian_id) have an earlier created_at (ties broken by rowid), which matches today's syncFamilyCoverage. members.guardian_id stays and always equals the active owner. Write both in one db.batch.
3. CREATE TABLE profile_invites (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('claim','guardian','guardian_request','release')), member_ids TEXT NOT NULL, invited_email TEXT, invited_by TEXT NOT NULL REFERENCES members(id), token_hash TEXT UNIQUE, confirmed_13_plus INTEGER NOT NULL DEFAULT 0, consent_at TEXT, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','declined','cancelled','expired')), expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
4. CREATE TABLE profile_moves (id INTEGER PRIMARY KEY AUTOINCREMENT, from_member_id TEXT NOT NULL, to_member_id TEXT NOT NULL REFERENCES members(id), moved_json TEXT NOT NULL, moved_by TEXT NOT NULL, reason TEXT NOT NULL CHECK (reason IN ('claim','guardian_request')), created_at TEXT NOT NULL DEFAULT (datetime('now')));
5. Before merging, run a preflight against production: SELECT uscf_id, COUNT(*) FROM members WHERE uscf_id IS NOT NULL AND role != 'guest' GROUP BY 1 HAVING COUNT(*) > 1. Then CREATE UNIQUE INDEX idx_members_uscf_unique ON members(uscf_id) WHERE uscf_id IS NOT NULL AND role != 'guest';
No birthdate, grade or child-email columns. members.email stays NOT NULL and holds the owner's address for unclaimed children, but nothing reads it for sending. WS13's two US Chess expiry columns are replaced by today's members.uscf_expiration plus uscf_checked_at. No dependents table.

Code:
- functions/utils/auth.ts requireAuthedMember and optionalAuthedMember: SELECT by auth_user_id = user.id, else by id = user.id AND auth_user_id IS NULL.
- functions/utils/members.ts upsertMemberFromAuth: resolve the same way and update email on the resolved row. Refuse a signup US Chess ID that is on a managed profile, with the message "Ask your parent or guardian to give you your own login from My LCA".
- The 17 places that use user.id as a member id switch to member.id.
- functions/utils/family.ts:
  to canActFor and listChildren read active member_guardians.
  to syncFamilyCoverage(db, guardianId) covers that guardian's links where family_covered = 1, at most 3, keeping the later expiry.
  to MAX_CHILDREN (8) counts active links.
- functions/api/me/children/[id].ts PATCH name: refused once the child is checked in to a running event. DELETE: only the sole active guardian, and only with no registrations or payments.
- functions/api/registrations/batch.ts keeps its shape, uses the new canActFor, rejects an entry already made for the same member_id by another guardian, and returns a plain over-9 message.
- The public event endpoint shows first name and last initial when the player has an active guardian link or the entry's eligibility_json is set. The public event endpoint also returns myPeople[] in place of myRegistration.
- generate-pairings familyOf: any shared active guardian.
- functions/api/admin/impersonate/[memberId].ts allows a child only when auth_user_id is set.
- New functions/utils/recipients.ts, used by registrationEmails.ts, the reminder senders and workers/daily-emails.

Endpoints:
- GET /api/me/family
- POST /api/me/children/:id/invite-login {email, is13Plus, consent}
- DELETE /api/me/children/:id/login
- POST /api/me/family/guardians/invite {email, memberIds[]}
- POST /api/me/children/guardian-request {uscfId or fullName}
- POST /api/profile-invites/:token/accept and /decline
- PATCH /api/me/children/:id/guardians/me {send_copies}
- DELETE /api/me/children/:id/guardians/:guardianId (owner removes, or a guardian leaves)
- POST /api/me/children/:id/release (owner)
- POST /api/me/release and POST /api/profile-invites/:id/cancel-release
- GET /api/admin/tournaments/:id/checkin-search?q=

Tests:
- role-safety: a claimed child cannot act for siblings or read guardian receipts; adult sign-in is unchanged.
- A test that enumerates every foreign key to members and fails if profile moves skip one.
- The family_covered backfill checked against a copy of production.

### 7.5 The "Register my family" picker, final content

Event page action area
- Signed out: button "Register my family", with the line "One checkout for you and your children. See how it works". It opens the sheet "How family registration works", which shows this picker filled with the sample Robichaux family. Buttons: "Get a Family membership", "Start: create your login", and the link "I already have a login: sign in".
- Signed in with an active Family membership: button "Register my family".
- Everyone else signed in: button "Register". Its first step is the same picker.

Picker page: /tournaments/:id/register

Heading: Who's playing?
Subheading: 2027 Paul Morphy Open and Morphy Scholastic · Sat-Sun, Jun 12-13, 2027 · New Orleans
Intro: Tick everyone who is playing, choose a section for each, and check each name. Names appear on pairings and results exactly as shown here.

List (one row per person you can register; everyone starts unticked)

[ ] Danielle Robichaux (you)
    Rating 1210 · US Chess ID ending 4410 · On your Family plan
    Edit name

[x] Maya Robichaux
    Rating 1102 · US Chess ID ending 7731 · On your Family plan
    Entrants list before the event: Maya R. · Pairings and results: Maya Robichaux
    Edit name
    Section (select, required). Options:
      Morphy Scholastic K-8 · Sat only · $25, $20 member price · 9 of 48 entered
      Morphy Scholastic K-12 · Sat only · $25, $20 member price · 6 of 40 entered
      Paul Morphy Open U1400 · Sat-Sun · $30, $20 member price · 5 of 15 entered
    Hint under the select: Not shown: U1000 (1102 is over 1000). Show K-5, K-3, U1800 and Open
    When K-8 is chosen: [ ] Maya is in 8th grade or below (required for this section)
    Help: One yes or no. We never ask for a grade or a birthdate.

[x] Leo Robichaux
    Unrated · US Chess ID ending 2286 · On your Family plan
    Entrants list before the event: Leo R. · Pairings and results: Leo Robichaux
    Edit name
    Section (select, required). Options:
      Morphy Scholastic K-3 · Sat only · $25, $20 member price · 6 of 12 entered
      Morphy Scholastic K-5 · Sat only · $25, $20 member price · 8 of 40 entered
      Paul Morphy Open U1000 · Sat-Sun · unrated welcome · $20, $15 member price · 2 of 15 entered
    When K-3 is chosen: [ ] Leo is in 3rd grade or below (required for this section)

Row states
- Locked: "Already registered by Marc R. for K-8". The checkbox is disabled.
- Edit name locked: "Checked in. Ask the director to fix the name."
- Not covered: "Not on your Family plan. Member price after you add Scholastic $5 in step 3."
- 10th person: "One order holds up to 9 players. Register the rest in a second order."

Link under the list: "Add a child" (first name, last name, US Chess ID optional; no email).

Note: Your Family membership is the only thing shared. It gives everyone on the plan the member price. Each player still pays the entry fee for the section they enter, so scholastic sections usually cost less.

Name confirmation (required): [ ] These names are spelled the way they should appear on pairings and results.
Error if left unticked: "Check the names, then tick the box to confirm them."

Running total (sticky on phones, side panel on desktop; updates live):
  Maya · Morphy Scholastic K-8 · $20
  Leo · Morphy Scholastic K-3 · $20
  2 players · $40
  Member prices applied. The total includes everything: no fees are added at payment.

Continue button: "Continue with 2 players · $40". Next steps: byes, US Chess check, then Check your answers.
Disabled until each ticked player has a section and any eligibility box their section needs, and the names box is ticked. Helper: "Choose a section for Leo to continue."

### 7.6 Brief text (version 1.3)

**WS06**
- **Household model (replaces the current bullet):** a household is a guardian plus the player profiles they guard. Each child is a `members` row (`child-<uuid>`, kept for life) linked through `member_guardians` (owner plus any number of guardians, each with their own login). Links end with ended_at and ended_reason and are never deleted. Children need no email or login. A login can be attached later with `members.auth_user_id`, from age 13, with recorded guardian consent. A second guardian is in scope now, not later.
- **"Register my family" visibility:** the button shows to signed-out visitors, where it opens "How family registration works" with a sample picker and a one-form path that creates the parent's login and first child, and to signed-in people with an active Family membership. Everyone else sees "Register", whose "Who's playing?" step still lists saved children.
- **Who's playing picker:** tick players, pick a section per player (eligible sections only, each fee and member price shown), check each name (entrants-list form and results form), and tick a required "These names are spelled the way they should appear on pairings and results". A running total and the note "Only the Family membership is shared. Each player pays their own section's entry fee." A child already entered by another guardian is locked with "Already registered by Marc R. for K-8". Edit name locks once the child is checked in to a running event. More than 9 players gets a plain second-order message.
- **Eligibility per entry:** "In 8th grade or below?" is asked on each entry and saved in `registrations.eligibility_json`, never on the profile.
- **No card processing line:** the Reg-C board's "Card processing" line is dropped. Totals are all-in (D2).
- **Teen self-entry:** a child with her own login can choose "Ask my guardian to pay", which creates an unpaid held entry for guardians.
- **Guest to profile:** "Save these details, create an account" turns guest child rows into managed profiles under the new login. A US Chess ID typed in Add a child converts a guest row only when the guest entry's payer email is the signed-in parent's.
- **Entrants list:** first name and last initial while the player has an active guardian link or the entry's eligibility_json is set. Pairings, standings, results and winners show full names (D3).
- **Emails:** every sender uses `recipientsFor(memberId)`, grouped per address. Receipts go to the payer only.

**WS12**
- **Family coverage is chosen, not by date:** at purchase and renewal the guardian ticks up to 3 children per plan (`member_guardians.family_covered`), and an open spot can be filled at any time. A 4th child is offered Scholastic $5 as a line in the same payment, and is never silently left out. In two-household families each guardian's plan can cover the child, and the later expiry wins.
- **No child emails at purchase:** "Children don't need an email. Everything comes to you. Each child can get their own login at 13 or older from My LCA."
- **Success page:** lists who is covered and the expiry with weekday ("Covered through Sun, Oct 10, 2027: Danielle, Maya, Leo. One open spot."), each name with "Fix a spelling".
- **Renewal reminder:** lists the covered children and flags anyone who now manages their own profile ("Maya now manages her own profile · Adult $15").
- **Digital card:** one card and signed QR per player profile (member_id), used by WS08 check-in to find the exact row.
- **TD membership desk:** sells Family for card or cash. Walk-in guest children of the paying adult become managed profiles on the spot.

**WS13**
- **Family section copy (replaces "Children don't get their own login"):** "Children don't need an email or a login. You register and pay for them and get their emails. From 13 you can give one their own login, and they keep all their history."
- **Family cards:** each card gains "Open Maya's page" (/me/players/:memberId, the same view Maya would see, with the strip "you manage this profile"), the filter chips "Everyone · Maya · Leo", a login status ("No login · emails come to you", "Invite sent Tue, Oct 13 · Resend", "Has her own login"), "Give Maya her own login" (requires the 13-or-older and consent checkboxes), "Remove Maya's login", and "Maya is 18: hand over her profile".
- **Guardians panel:** "Invite a guardian", requests to Approve or Decline, Remove (owner only), Leave, and a "Send me copies" toggle per child (the last one is disabled while the child has no login). Co-guardians are shown as first name and last initial.
- **Needs attention rank 1** also covers a teen's "Ask my guardian to pay": "Unpaid entry: Maya, The Baton Rouge Classic, U1400, $20 · Pay".
- **Add a child form:** first name, last name and optional US Chess ID only. The eighth-grade checkbox moves to each entry (WS06).
- **Event-day view and alerts:** one grouped email per guardian per round, with each line starting with the child's name. The "Text me" control stays hidden until SMS exists.
- **Claimed teen's dashboard:** her own My LCA with her entries, pairings, results, reminders, card and "I'm 18 or older: manage my profile myself" (takes effect after 7 days, and guardians are told at once).

### 7.7 Questions for K on the family model
Each has a default in bold; silence keeps the default.

1. Should "Register my family" also show for a signed-in parent with saved children but no Family plan (for example two $5 Scholastic memberships, which the optimizer recommends when only the children play)? **Default: no. Keep your rule exactly. Their normal Register button already lists their children in the same picker.**
2. Is 13 the right age for a child's own login, and is the guardian's "13 or older" checkbox plus a recorded consent checkbox enough? **Default: yes, 13 or older with both checkboxes recorded. Under 13, no login and no child email.**
3. After a teen gets her own login, can guardians turn off their copies, and can the teen turn them off? **Default: each guardian can turn off their own copies. The teen cannot turn guardians' copies off before she manages her own profile.**
4. Should a self-declared "I'm 18 or older" take effect at once? **Default: after 7 days. Guardians are emailed at once and any guardian can cancel. A second request then needs the owner's approval.**
5. Is moving history from a duplicate profile onto the family profile acceptable without an admin, when the same-person check passes (names match, US Chess IDs don't conflict, no staff roles or children, not both entered in one event) and every move is logged so a developer can reverse it? **Default: yes. Anything that fails the check is refused with a plain message, not queued for volunteers.**
6. In a separation, who can remove a co-guardian? **Default: only the owner (the guardian who added the child or holds ownership). Co-guardians can only leave. LCA takes no role in custody disputes beyond following the owner.**
7. In the TD console, does a guardian show as a full name, and can TDs search by a parent's name? **Default: full name and searchable, inside the TD console only. Never on public pages.**
8. Can a parent with 4 or more children change which 3 the Family plan covers mid-year? **Default: no. Ticks change at renewal, and an empty spot can be filled at any time. Entries already paid keep their price.**
9. Where does the scholastic emergency contact from Account-B live? **Default: once on the owner's account, reused on each child's scholastic entry and shown only to that event's TD.**
10. Should a short public LCA member number be added to make profiles findable? **Default: no. The US Chess ID, the parent's name in the TD console and the per-profile card QR are enough.**
11. Round texts: SMS doesn't exist yet. **Default: round alerts are email only until SMS is built. When it is, texts follow the same routing rule, using each guardian's own phone.**
12. Can the TD membership desk sell a Family plan for cash and turn walk-in guest children into the payer's profiles on the spot? **Default: yes, because the TD sees the family in person. Otherwise it happens through the emailed "Save these details, create an account" link.**

## 8. Where it lands in the brief (version 1.3)

### 8.1 WS05 · Event page template & lifecycle
- **Canvas boards:** `Event-Final-1` (two schedules that merge), `Event-Final-2` (one schedule, limits by section), `Event-Final-States`, `Event-Final-Family`, `Event-Final-Setup`, `Event-Partner-Final`, `Event-Festival-Final`, `Event-Phones-Final`.
- **Template:** one page for every LCA-run and club-run event, as in `DESIGN_REPLAN_phase1.md` sections 5 and 6: B's top band with the key-facts card, the sticky `EventSubNav` (hashes #overview #sections #schedule #whos-coming #venue #good-to-know #pairings #standings), the main column whose sections and schedule take A's form with one schedule and B's form with two, side events, who's coming, venue and travel, good to know; the sidebar with A's registration card, hotel and travel (setup), round alerts (registered viewers only), and the link preview.
- **Layouts:** the `layout` column is not added. The multi-schedule form is derived from `schedules[]` having more than one entry. Festivals are their own table (8.5). `display_state` stays as the TD override.
- **Data model additions** (replacing the WS05 sketch): `ALTER TABLE tournaments ADD COLUMN tagline TEXT; ADD COLUMN championship_title TEXT; ADD COLUMN entry_limit_mode TEXT NOT NULL DEFAULT 'overall' CHECK (entry_limit_mode IN ('overall','by_section')); ADD COLUMN schedules TEXT; ADD COLUMN merge_round INTEGER; ADD COLUMN parent_event_id TEXT REFERENCES tournaments(id); ADD COLUMN kind TEXT NOT NULL DEFAULT 'main' CHECK (kind IN ('main','side','meeting')); ADD COLUMN display_state TEXT NOT NULL DEFAULT 'auto' CHECK (display_state IN ('auto','before','during','after')); ADD COLUMN venue_notes TEXT; ADD COLUMN good_to_know_json TEXT; ADD COLUMN travel_json TEXT;` (verify each is absent first; `max_players` stays as the overall limit). The sections JSON gains `cap` per section. `schedules` is a JSON array of `{id, label, time_control, rounds: [{round, date, time}]}`; when it is null the existing `round_schedule` list is the one schedule. `registrations` gains `schedule_id TEXT`. `public_minor_names` is not added: the pre-event entrants list uses page 4's `GET /api/events/:id/entrants` rule (dependent profiles and members who ticked "I'm under 18" show as first name and last initial), while results, standings and winners keep full names (D3).
- **API:** `GET /api/tournaments/[id]` adds `state`, `entry_limit_mode`, per-section `entered`, `cap`, `fee_now`, `next_fee_change`, `schedules`, `merge_round`, `side_events[]` (child rows with their own counts and caps), `travel`, `tagline`, `championship_title`, and no longer returns the public roster with full names for dependents (the entrants endpoint does that).
- **Frontend:** `EventSubNav` replaces `ChampionshipTabs`; `ScheduleList` renders one or many schedules; `SectionsGrid` and `SectionsAndPrizes` are the two forms; `SideEvents`, `TravelBlock`, `RoundAlertsCard`, `LinkPreviewCard`, `RegisterFamilyButton` (with the explainer sheet) are new; `RegistrationCard` carries the section and schedule pickers and the count line by limit mode.
- **Acceptance criteria** (replacing 3 and 6, adding 8 to 12): 3. With limits by section, each capped section shows "N of cap" and the date of the next price change; with an overall limit the section cards show "N entered" and no bar; with no limit the page shows the entered count and no bar. 6. The sub nav is deep-linkable and keyboard accessible on every event; Pairings and Standings are `aria-disabled` before the event. 8. The card's fee block shows only the tiers the setup has; with Regular alone it shows one line. 9. Register my family renders only for a signed-out viewer or an active Family member; the explainer sheet opens signed out. 10. With two schedules the card and the family picker require a schedule choice and store it on the registration. 11. No club name renders in Who's coming. 12. Round alerts render only for a registered viewer or the guardian of one, with one email switch per registered person and no SMS or phone option.

### 8.2 WS06 · Registration & households
- The **Register my family** picker is the household flow's first step opened from the event page (section 7 for the account model): confirm who is playing and the public form of each name, eligibility by checkbox before any scholastic section, a section or side event per person at the member price, a schedule per person where there are two, one total, one payment, one order (`registration_orders`) spanning the main event and its side events.
- **Per-section enforcement:** `POST /api/registrations/orders` checks the section cap and the overall limit (by `entry_limit_mode`), holds seats per section, and waitlists per section when limits are by section; `batch.ts` is extended rather than duplicated.
- The 9-entry limit per order stands.

### 8.3 WS07 · Live mode
- Round alerts are email only. A registered player is opted in at registration and can switch off from the event page or My LCA; a guardian gets one switch per registered dependent at the guardian's address. (This amends "opted-in players" to "registered players who have not switched off", question 9.4.)

### 8.4 WS08 · Director & admin tools
- The **setup checklist** gains: a tagline and a championship title in Basics; the entry-limit mode and per-section caps in Sections; the fee ladder with Early and Late optional in Fees; a **Schedules** step (off by default: a second schedule, its rounds and time control, the merge round); a **Side events** step (off by default: child events of kind side or meeting, with their own sections, fees and caps); a **Hotel & travel** step (off by default: `travel_json`); the display override in Publish. Every option is editable after creation. Board `Event-Final-Setup`.
- The **admin queue** gains a sixth source, `listing_report`, for partner-listing problem reports.
- **Festival pages** (8.5) are created and managed from `/admin/festivals` (admin only).

### 8.5 Festivals (new, under WS05)
- Table `festivals` (`id`, `slug`, `name`, `start_date`, `end_date`, `city`, `venue`, `hero_photo_url`, `tagline`, `intro`, `visiting_note`, `blocks_json`, `visit_json`, `partners_json`, `faq_json`, `status` 'draft' | 'live' | 'offline', `featured` 0 | 1, `created_by`, `created_at`, `updated_at`) and `festival_events` (`festival_id`, `tournament_id`, `position`), LCA-run events only. Public page `/festivals/:slug` (board `Event-Festival-Final` frame A); admin panel `/admin/festivals/new` and `/:id` (frame B) with Go live, Take offline and Feature on the home page (disabled while draft; one featured festival at a time; cleared by Take offline or the end date). No bundle pricing.
- **WS03 amendment:** the hero ladder gains an admin-pinned **Featured** rung after Live and Event day, returned by `/api/home` (`featured_festival`), with one primary "Choose your event" and a plain "See the schedule" link; when the live or event-day event belongs to the featured festival, the festival hero stays and carries the live line. `homeFeatured` flag.

### 8.6 WS04 · Partner pages (amending the Event-E bullets)
- Buttons: "Registers on the organizer's site ↗" (navy), Add to calendar (disabled with "Date to be confirmed" when the date is unconfirmed), Remind me (the two date reminders plus "If this listing changes", kind `listing_changed`, sent when the sync's diff touches date, venue, link or cancellation).
- Human-error rules: a fixed facts card whose blank rows read "Not in the listing yet"; a missing venue uses the city for the map and drive times ("from the city centre"); a missing city hides both; a TBA, month-only, unparseable or impossible date reads "Date to be confirmed by the organizer"; a missing link makes "Contact the organizer" the main action; a bare link gets https:// and is checked before the button shows; a stale sync and a listing that left the feed are stated in words and the page is kept; a changed date adds a history row with weekdays; a probable duplicate is merged under one page with an admin-only tag. Data: `clearinghouse_history` (`clearinghouse_id`, `changed_at`, `field`, `from`, `to`) written by `workers/clearinghouse-sync`; `tournament_reminders.kind` gains 'listing_changed'.

### 8.7 WS10 · Champions
- `tournaments.championship_title` is a slug matching `state_champions.title`; the honor roll accepts `?title=` and the event page's "Past champions ↗" links there.

## 9. Questions for K
Each has a default in bold; silence keeps the default.
1. **Who's coming filters.** The event page keeps A's one table sorted by rating with section chips as filters, while the page 4 preview groups by section. **Keep both as drawn**, or group the event page by section too.
2. **Section picker with many sections.** Above four sections the card's segmented picker becomes a select. **Keep.**
3. **A featured festival and a live event.** When an unrelated LCA event is live or on its day, Live outranks the featured festival on the home page. **Keep**, or let the featured festival always lead.
4. **Round alerts default.** Registered players are opted in at registration and can switch off. **Keep**, or make it opt-in (off until switched on).
5. **Festival bundle.** D's "Open + Blitz" bundle price was dropped because pricing cannot express it. **Dropped**; say so if LCA wants bundle pricing in Phase 1.
6. **The State Championship's business meeting** is a side event of kind "meeting" on the event page, with the RSVP WS14 already plans. **Keep.**

## 10. Board index for page 5
| Board | Size | What it shows | Replaces |
|---|---|---|---|
| `Event-Final-1` | 1440 × 7450 | the unified page, setup: two schedules that merge, signed out, hotel and travel on, side events on, overall limit | `Event-A`, `Event-B`, `Event-C` |
| `Event-Final-2` | 1440 × 6450 | the unified page, setup: one schedule, limits by section, signed-in member, plus the club-run inset | (with the above) |
| `Event-Final-States` | 1440 × 8000 | six card variants, the family row, the button strips, during and after tops, the registered sidebar | `Event-C` |
| `Event-Final-Family` | 1440 × 6400 | the who's playing picker, the signed-out explainer, the phone picker | new |
| `Event-Final-Setup` | 1440 × 6000 | the TD setup panel with the new options | new (feeds WS08) |
| `Event-Partner-Final` | 1440 × 7700 | the partner page and eight human-error states | `Event-E` |
| `Event-Festival-Final-1`, `-2` | 1440 × 7900 and 1440 × 6450 | the public festival page; the admin panel and the home hero in festival mode | `Event-D` |
| `Event-Phones-Final` | 2800 × 4500 | the phone frames | `Event-Phones` |

## 11. Second round on the Tournament page and the family picker (October 8)

> "I think we should find a way to combine the venue & travel section with the hotel & travel section. It can just be the venue and travel block with an optional hotel addition at the bottom. The new summarized venue & travel thing should take the place of the hotel & travel on the sidebar … the schedule picker is essential to know who will show up when … In the drop down for the register my family thing, it shows $25, $20 member price, this will never be needed, there are not different prices for members or non-members, people must buy a LCA membership to play in their tournaments. Take into account that I would like for a while once we allow the public to access this for people to be able to run their own tournaments with it not forcing their members to have LCA memberships … that should be an option on tournament creation. But the board may want me to force it on everyone in the future … change the explainer text at the bottom of the get a family membership to 'Everyone on the plan gets a LCA membership' … on the phone version of the family registration, it is probably a good idea to preserve space by not showing the price and entry counts below the section selector. Same thing with the extra details of the selected family member under their name … at the very bottom, as stated there is no such thing as a member price … Make sure they cant add over the limit of family members. For the tournament setup screen … be sure to put it in a scroll container since it will be really long … same with any other page so that the content stays together nicely."

**Decisions**
- **One entry price.** There is no member price and no member discount anywhere on the site; `member_discount` is retired from pricing. A section has one fee per tier (Early, Regular, Late, only the tiers the setup has). Every board and the brief's WS04, WS05, WS06 and WS12 text follow.
- **LCA events require an LCA membership to enter.** The registration card says so ("LCA membership required to enter · $15 a year, added at checkout if you don't have one"; an active member sees their expiry instead). The household checkout's membership step becomes required for anyone in the order without an active membership: the Family plan covers the guardian and up to 3 children; a 4th child is added with a Scholastic membership ($5) in the same payment; an adult joins at the Adult, Senior or Family tier.
- **A per-tournament setting, `requires_lca_membership`** (default on), lets a club running its own event on the site switch the requirement off; the setup's Fees step carries it as "LCA membership: Required to enter (default) · Not required". This switch is how tournament creation and management will first be rolled out to LCA's clubs: they can create, test and run their own events without their players paying LCA. A site-wide override (`membership_required_for_all`, admin only) is planned so the board can force the requirement on every event later without a code change.
- **The checkout adds the right membership for each person.** When an event requires a membership and a player in the order lacks an active one, step 3 offers the tier that applies to that person (Adult, Scholastic for a K–12 player, Senior at 65 or older, or Family when it covers the household more cheaply), using the WS12 household optimizer, and the membership is paid in the same payment as the entries.
- **Venue & travel is one block.** The main column's block (#venue) holds the venue (name, address, map, parking, getting in, food), then "Getting here" when the setup has travel details on (airport, drive times, between rounds), then an optional hotel at the bottom (host hotel, LCA rate, block deadline, booking link). The sidebar's Hotel & travel card becomes a "Venue & travel" summary card (venue, city, Open in Maps, one parking line, the hotel line when set, a link to the full block). The setup's step 6 is "Venue & travel": venue fields always, a "Travel details" switch, and "Add a hotel".
- **The schedule picker stays** on the card, in the picker and on phones; the player's choice is stored on the registration so the TD knows who plays which rounds when.
- **The family picker:** the explainer line under "Get a Family membership · $25 a year" reads exactly "Everyone on the plan gets a LCA membership". Section options show the fee and the entered count only ("Labor Day Scholastic · K–8 · $25 · 14 of 60 entered"). The running total's footer reads "Entry fees only. Anyone without an LCA membership gets one added in step 3. No card fees are added at payment." On phones the options show no price or count under the selector (they are in the sheet that opens), the detail line under each name is gone and the one essential sits beside the name ("Maya Robichaux · 1102", "Leo Robichaux · unrated"); the public-name line lives in the Edit name sheet.
- **The family limit is enforced.** "Add a family member" shows the plan's remaining spots ("Your Family plan covers 3 children · 1 spot left"); when the plan is full it says a 4th child is added with a Scholastic membership and still allows the add; at 8 profiles (today's `MAX_CHILDREN`) the link is disabled with "Your family list is full (8)". The server refuses a 9th profile and an order with more than 9 players as today.
- **Long forms scroll in their own container.** The setup page's form scrolls inside a container with the steps rail and the page preview sticky beside it; phone sheets and the family picker scroll inside the sheet; the sticky bars never cover a focused control (`scroll-margin`, `--bottom-chrome-h`).

**Where it lands in the brief (version 1.3)**
- WS05 data model: `ALTER TABLE tournaments ADD COLUMN requires_lca_membership INTEGER NOT NULL DEFAULT 1;` and a `site_settings` row `membership_required_for_all` (admin only, default off). `member_discount` is no longer read; the pricing helper takes the section, the tier dates and the date, nothing about the viewer.
- WS05 page: the card's membership line by viewer state; the Venue & travel block and the summary card; the schedule picker; Good to know's Membership item.
- WS06: the membership step is required when the event requires it and any player in the order lacks an active membership; the picker copy above; the 9-player and 8-profile limits.
- WS08: the Fees step loses the member discount and gains the membership switch; step 6 is Venue & travel with the travel switch and the hotel addition; the setup form scrolls in its own container.
- WS12: the household optimizer runs inside the checkout's membership step when someone needs a membership; "Everyone on the plan gets a LCA membership" is the Family tier's one-line description everywhere.

## 12. Registration (canvas page 6), decided

K: "I really like what you did with this, also great thinking on the receipts, make sure that is in there in any payment thing because we have gotten gripes about that in the past. We setup something for this previously … marry the systems as you see fit or make this one overwrite it completely (don't want duplicate receipt emails)."

**Decisions**
- **The household checkout is Reg-C with the family model of section 7:** step 1 "Who's playing?" is the picker (section 7.5 as amended in section 11), then Byes and US Chess IDs, then LCA membership (required when the event requires it and anyone lacks one; the optimizer picks the cheapest valid combination), then Check your answers (one line per player at the price paid, one total, no card-fee line, D2), then Stripe Checkout in the same tab, then one confirmation card per player with its own Withdraw link. The guest path (Reg-D) and the waitlist, holds and refunds stand as the brief has them. The Reg-A in-card flow on desktop and the Reg-B one-question sheet on phones are the same engine's other two presentations.
- **Receipts, one system for every payment.** Today no LCA receipt exists: the only post-payment email is "You're registered", memberships and donations send nothing, and Stripe's own receipt goes out separately. The redesign sends, for every completed payment (registration orders, memberships, donations, walk-in card payments): **one receipt to the payer** ("Receipt: 2027 Paul Morphy Open, 3 players · $87.00", one line per player or item with its amount, the date with weekday, the last four digits of the card, the Stripe reference, a link to the order in My LCA, and the refund rule in one line), plus **one confirmation per player** ("You're registered: …", the existing template, grouped per recipient as today, without the Paid total, which the receipt carries). Stripe's email receipts are turned off in the Stripe dashboard so nobody gets two. The confirmation for a mixed order (free and paid entries) is sent once, when the order completes, not once for the free entries and again at the webhook.
- **Marrying the systems:** `sendRegistrationConfirmations` stays as the player-confirmation sender, extended to take an order id; a new `sendPaymentReceipt(orderOrPaymentId)` in `functions/utils/receipts.ts` sends the receipt through the branded layout; both are called from one place, the webhook's order completion, and from the free-order path. Membership activation and donations call `sendPaymentReceipt` too. A `stripe_events` table (`event_id` primary key, `received_at`) makes the webhook idempotent before any email is sent, replacing today's read-then-write guard that can double-send under concurrent deliveries. Receipts can be re-sent from My LCA ("Send me this receipt again") and from the admin's payment row.
- **Acceptance (WS06, added):** 9. Every completed payment produces exactly one receipt to the payer and one confirmation per player, verified by the integration harness's email outbox under a replayed and a concurrent webhook delivery. 10. Memberships and donations produce a receipt. 11. A mixed free-and-paid order produces one confirmation per player, not two.
