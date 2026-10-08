# Phase 1 design replan, part 1: the Tournaments list (canvas page 4)

**For:** K (owner) and the engineer building WS04
**Status:** decided by K on October 8, 2026, in two rounds. Nothing here is built yet.
**Date:** October 8, 2026
**Companion:** `REDESIGN_SPEC.md` v1.2. Section 5 of this document holds the WS04 text that replaces parts of the brief. It is applied as version 1.3 together with the Tournament page (page 5) and Registration (page 6) decisions, so the Phase 1 brief changes land once. Until then this document wins over WS04 where they disagree.

The decided boards are on canvas page 4 ("4 · Tournaments list") and copied into `docs/redesign/decided-boards`: `Tourn-List-Final`, `Tourn-List-States`, `Tourn-Calendar-Final`, `Tourn-Map-Final`, `Tourn-Table-Final` and `Tourn-Phones-Final`. They replace `Tourn-A` to `Tourn-E` and `Tourn-Phones`, and the nine option boards drawn in between.

---

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
