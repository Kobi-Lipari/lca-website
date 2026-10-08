# Phase 0 design replan: look scopes, navigation, homepage and search

**For:** K (owner) and the engineer building Phase 0 (WS01 → WS02 → WS03)
**Status:** draft for K's approval. Nothing here is built yet.
**Date:** October 8, 2026
**Companion:** `REDESIGN_SPEC.md` v1.1. Section 5 of this document holds the exact text that replaces parts of the brief once K approves. Everything else in the brief stands, including section 0.1 (standing rules) and decisions D1–D10.

This document answers five questions K's October 8 notes left open, with a recommended design for each, and turns the answers into brief amendments ready to paste. Where the design review panel disagreed, the choice is made here and the reason is given in one sentence.

A note on example events: the boards use the Lafayette Open as their sample. The Lafayette Open is a partner event that registers on the organizer's site, so it can never carry event mode, a Register button or a count. Every example below uses an LCA-run event instead: the Paul Morphy Open (Sat–Sun, Jun 12–13, 2027, New Orleans), the Louisiana State Championship (Sat–Mon, Sep 5–7, 2026, Sulphur) or the State Scholastic Championship (Sat, Apr 10, 2027).

---

## 1. What K decided

K gave three notes on October 8. Each is restated here as a decision, followed by how each ambiguous phrase was read. Where a reading could go two ways, section 6 asks K to confirm.

### Note 1: the looks

> "I really like your choice of using heritage club and modern tech-minimal as the main ones because they are both really good and I could see them both having their place for certain things. and I also love the idea of having a distinct theme to show that stuff is live with Broadcast night. good to go on this!"

**Decisions**
- Modern Tech-Minimal is the site-wide base. Unchanged from the brief.
- Heritage Club is a real look with a place of its own, not just an accent. The brief's "accent on About, Champions and the history timeline only" is too small for "both really good" and "their place for certain things". Heritage now covers whole pages (section 2, Q1).
- Broadcast Night is the live theme and stays exactly where the brief puts it, plus one addition: the header's event strip takes the live tokens while a round is live, so "a distinct theme to show that stuff is live" reaches the one surface every page shares.

**How the ambiguous phrases were read**
- "their place for certain things" was read as: Heritage for LCA's permanent record (governance, champions, history, keepsakes), Minimal for everything a person uses or acts on. This gives the engineer a one-sentence rule.
- K did not mention Bright Scholastic. That was read as "not decided", not "dropped". The scholastic scope stays planned for `/scholastic/*`, with its fonts and rollout moved to WS11 (Phase 3) behind its own flag, so Phase 0 spends nothing on it and nothing is silently removed. Section 6 asks K to confirm.

### Note 2: structure, header, mobile, footer

> "Structure 1, I like the H4 and H5 thing, we should include them both. let me know if I need to help with more design choices here, etc, for the mobile nav options, I really like the 2 bottom tab bar thing, also i really like 4 event day mode pop ups at the top and bottom for when there is an event that the person has registered in or is a td in or is an admin (so every one that would be involved can see it and can see it had the correct info, ect), for the footer I like F1 best."

**Decisions**
- Site structure: Nav-IA structure 1 (Tournaments · Clubs · Scholastic · News · Membership · About). Unchanged.
- Header: H1 Refined as the base, plus H4 (search in the header) and H5 (the event-mode strip).
- Mobile: M2 bottom tab bar as the navigation, plus M4's top banner and bottom pill in event mode.
- Footer: F1 as drawn (the board's four columns, minus links to pages that do not exist), with F3's trust line as the brief already adds.

**How the ambiguous phrases were read**
- "include them both" (H4 and H5). H5 is taken literally: a strip under the header. H4 is taken as "search is visibly present in the header on every page", not as H4's literal two-row layout. H4 drops the six sections to a second 46px row; with the H5 strip that is about 174px of sticky chrome, roughly a fifth of a laptop screen. The header keeps a field-shaped Search button that opens the search panel, and the full search box goes on the homepage (note 3). Section 6 asks K to confirm this reading.
- H5's own details. H5 draws a 60px brand-gold band, an "in 19 min" countdown chip and a round-alert bell. The band becomes a light gold tint before and after the event and the live tokens during rounds, because brand gold is never a text ground (rule 0.1.6) and the live state should read as different. The countdown is replaced by the absolute time ("starts 7:00 PM"); WCAG 2.2.2 is met by the Hide button either way, so dropping it is a design choice, and section 6 puts both changes to K. The bell is hidden until WS07's email alerts exist (D8).
- "registered in or is a td in or is an admin". Event mode is for involved people: a registered player (including waitlisted), the guardian of a registered child, the event's TDs, and LCA admins. Everyone involved sees it with details that are correct for them. The general public sees no strip. During a live round the public sees a worded "Live" tag on the Tournaments nav item and the homepage's live hero, which is enough to reach pairings in one tap.
- "can see it had the correct info". Read two ways, both built: each role gets its own line computed from the data volunteers already enter, and TDs and admins get a "Players see:" echo that quotes the exact line players are reading.
- "pop ups at the top and bottom" with "the 2 bottom tab bar". M4's pill was drawn with no tab bar and M2 with no pill, so the boards never show the shared bottom edge. The pill becomes a bar docked directly above the tab bar, in the same reserved stack, so it never floats over content and never replaces a tab. On phones the bar appears from check-in on day 1, not during event week (desktop shows the strip from 6 days out); the week is a card at the top of My LCA and on Home instead. Section 6 puts the docking and the week asymmetry to K.
- "2 bottom tab bar thing" with "Events" as the first label. M2 says "Events"; desktop says "Tournaments". One word everywhere: "Tournaments".

### Note 3: homepage

> "I like A best, I love the idea of having the next tournament info shown ect, but we should plan what to have there if there is not an upcoming tournament in the next month ( we should plan further for this), also maybe that search bar idea for the nav bar has a better place elsewhere on the home page ect. on phones, A, but same as previously stated for this"

**Decisions**
- Home-A's next-event hero is the homepage, on desktop and phones.
- The fallback is a full ladder of hero modes, designed around the real calendar: LCA runs three to six events a year, so "no LCA event within a month" is the usual state, not the exception. The fallback is the common case and is designed as such.
- Search gets a visible box on the homepage, in a band directly under the hero in every mode, and a compact trigger in the header everywhere else.

**How the ambiguous phrases were read**
- "in the next month" sets the registration window at 30 days (the brief said 21), with one override: an early-entry deadline within 14 days also brings the event into the hero, so families who plan ahead see the price step before it passes.
- "a better place elsewhere on the home page" was read as "below the hero", not "as the hero". The next-event information K loves stays the lead. Search is never the hero, even in the quiet state.
- "on phones, A, but same as previously stated" means the same ladder at 390px.
- What survives from Home-A. Phase 0 builds the hero card, the identity line, the upcoming six, results, news and Facebook, and the membership band. Deferred: "This week at the clubs" (WS09); "Subscribe (.ics)" and "Add to calendar" on the list, and the "Louisiana / Add Gulf South" toggle (WS04; the upcoming six is Louisiana-only in Phase 0, with the brief's "All tournaments" link for the rest). Dropped: the "Start here" row, because the doors band below carries the same three tasks; K can ask for it back.

### Standing constraints honoured throughout

Every proposal below keeps section 0.1 of the brief (the attribution rule in 0.1.1, collect only what's needed, "300+ members" and every Facebook link kept, partner events register on the organizer's site, WCAG 2.2 AA with status in words, brand gold never text on light grounds, plain language with weekdays on dates and ½ for half points, nothing auto-advances) and decisions D1–D10 (logo by space, polling only, no text messages, no player pages). Everything user-visible ships behind a flag in `src/lib/features.ts`. The dependency order stays WS01 → WS02 → WS03, and every surface degrades gracefully until WS07 (live data), WS09 (club schedules) and WS10 (results) arrive.

---

## 2. Recommendations

### Q1. Look scoping: Heritage Club, Modern Tech-Minimal and the scholastic scope

#### The rule

**Minimal is for doing, Heritage is for the lasting record, Broadcast is for what is live right now.** A page gets Heritage only when its content is official, permanent or ceremonial and changes a few times a year. Anything with a form, a filter, a queue, a deadline or a payment stays Minimal. The header and footer are always the base look, on every page.

#### Where Heritage applies

Heritage has two levels.

**Level A: full scope** (`data-theme="heritage"` on the page's `<main>`, heritage fonts load)
- `/about` (About hub, including the history timeline)
- `/governance/board` (Board & regions)
- `/governance/bylaws` and `/governance/minutes`, the whole page. There is no separate editor route: `BylawsPage` and `MinutesPage` render `GovernanceDocuments` inline, with the TipTap editor lazy-loaded inside it. So `GovernanceDocuments` wraps its admin add/edit form and `RichTextEditor` in `<ThemeScope scope="base">`, a `data-theme=""` boundary that restores the base tokens, and the editors stay Minimal inside a Heritage page. Every other form inside a heritage page gets the same wrapper.
- `/meeting` (Annual meeting)
- `/champions` (honour roll; `/state-champions` keeps redirecting there)
- Keepsakes built later: the membership card face and its printable version (WS12), champion and section-winner certificates (WS10), the cover of a state championship's final report (WS07 print kit).
- A component scope for `HonorBoard` (WS10): the block above the final standings of an event with `is_state_championship = 1` and status completed. It never appears on a live or ordinary event. The standings table beneath it stays the shared `StandingsTable`.

**Level B: accent only** (base scope, Geist, no heritage fonts)
- The homepage identity band ("Louisiana's chess community since 1915 · 300+ members · 25+ clubs · 7 regions") gets a CSS thick–thin rule and the official logo (D1).
- The homepage Champions band (from `/api/champions`, Phase 0): navy band, `ThickThinRule`, `Seal` SVG, champion names in Geist.
- The homepage Results-mode winners block: the same accent primitives.

The accent level exists so Heritage is visible on the busiest page at zero font cost. The heritage font chunk must never appear in the `/` network log (acceptance test).

**Stays Minimal:** the homepage otherwise, Tournaments, every event page, registration and checkout, `/membership` and `/donate` (choose-and-pay flows must look like every other checkout), Clubs, News, Scholastic (for now), My LCA, workspace and admin, Scanner, search, the hall print kit (pairings sheets, wall charts, QR posters use a large-type print stylesheet), and all email. One Minimal email layout with the official logo in system fonts; governance and annual-meeting notices may add a CSS thick–thin rule, nothing more.

#### What Heritage changes and what it never changes

- **Changes:** headings and body type, one thick–thin rule per section (3px + 1px navy; gold on navy), the seal, honour-board table heads in small caps, the grounds (paper `#f7f3e8`, card `#fffdf8`, inset `#ece4d0`, hairline `#d8cdb4`), and gold-ink, which resolves to `#705718` inside the scope (6.18:1 on paper) because the base `#866a1e` is only 4.63:1 there.
- **Never changes:** `Button`, `Input`, chips, nav, `StatusBadge` words, colours and shapes, the focus ring, the radius on controls, and date and score formats. Every scope renders the base components, so what you can tap looks the same site-wide (WCAG 3.2.4). The scope's 2px radius applies to cards, tables and hero mats only.
- Brand gold `#c8a94a` is used for rules, seals and text on navy only. It is 2.05:1 on paper and is never text there. The gold-text guard test becomes scope-aware.
- Tiebreaks print as 13½, never 13.5. The Heritage board's decimals are rejected.
- Small caps only on labels of 15px or more, never on buttons or sentences. Caslon only for headlines of 32px or more and display numerals ("1915", "300+"), never for ratings, scores or tables.
- The bylaws and minutes reader body is Source Serif 4 at 18px / 1.6 with a 70ch measure.
- Dark mode: under `.dark`, Heritage keeps its type, rules and seal on the Minimal dark grounds. There is no second dark palette to draw, test or maintain. Gold text is allowed on dark grounds.
- Scopes nest one level only, and base-inside-heritage is the one permitted nesting (`ThemeScope scope="base"` around editors and forms). Heritage never renders inside `live`.

#### Fonts

Heritage loads its own faces, lazily, inside the scope only. This replaces the brief's "Heritage pages reuse Instrument Serif", which cannot produce the board K approved: Instrument Serif has no true small caps, no text weights, no tabular figures and no ½ glyph.

- Libre Caslon Display 400 (latin), for h1 and h2 at 32px and up.
- Source Serif 4 variable (latin, roman; the italic `@font-face` is declared but fetched only when used), for body, true small-caps labels (`font-variant-caps: all-small-caps`, letter-spacing .08em), lining and tabular figures.
- Geist Mono for every number, ½ and notation, in every scope. IBM Plex Mono from the Heritage tile is not loaded; a third mono face gains nothing and would split the one `ResultCell` and `StandingsTable` design.
- Instrument Serif stays the base look's single accent and never appears inside a heritage scope. It is not removed from the homepage.
- Budget: the heritage chunk is at most 110 KB of woff2. If it is over, drop the italic file first.
- A Georgia fallback face with `size-adjust` and `ascent-override` keeps the swap under CLS 0.1.
- Verify the Fontsource latin subset keeps the `smcp` and `c2sc` features. If it does not, fall back to uppercase at 0.85em with .06–.08em tracking, never browser-synthesised small caps.

#### Implementation

- `data-theme` takes (none) for base, `heritage`, `live` and `scholastic`. `.dark` on `<html>` is a separate switch.
- All scope token blocks live in `src/index.css` (about 40 lines each), so switching scope never flashes base colours. Only the `@font-face` chunks are lazy.
- `ThemeScope` sets the attribute and imports `src/styles/themes/<scope>.css` once. A lazy `HeritageLayout` layout route in `App.tsx` wraps the six existing routes (About, Board, Bylaws, Minutes, Annual meeting, Champions) and keeps `GovLayout` inside it. A unit test over the route-to-scope map asserts that no workspace or admin route is ever heritage, and a component test renders `RichTextEditor` and the `GovernanceDocuments` form inside `HeritageLayout` and asserts that the closest `data-theme` above each root is not `heritage`.
- New primitives in WS01: `ThickThinRule`, `Seal` (SVG built from `LcaMark`), and a `.small-caps` utility. `HonorBoard` arrives in WS10 as a skin over `StandingsTable`, not a new table.
- `--gold-ink` is one token that resolves to `#705718` inside heritage and `#866a1e` in base; no component hard-codes either.
- Flag: `themeHeritage` (default false): "About, Board, Bylaws, Minutes, Annual meeting and Champions pages in the Heritage Club look."

#### Bright Scholastic

Keep it, scoped to `/scholastic/*` only (today a single `/scholastic` route; later the hub and first-tournament guide), never on registration, checkout, shared event pages, pairings or standings. Those show a grade-band chip carrying its words ("K–5"). Colour only ever means a grade band, always next to the band's words, and status tags always use the base status tokens. WS01 ships only the scholastic token block and an axe fixture, so the brief's WS01 acceptance item 1 keeps its scholastic entry. The Baloo 2 and Nunito chunk and the rollout move to WS11 behind `themeScholastic` (default false). Until then `/scholastic` is Minimal. Section 6 asks K to confirm.

#### Broadcast Night

Exactly as the brief has it: `data-theme="live"` on pairings, standings, My board, hall TV and the event page while a round is live, plus the Night toggle and the homepage hero's live mode. One addition is decided under Q2: the header event strip takes the live colour tokens while a round is live (Geist stays; Barlow never loads outside the live routes). The homepage live hero (Q4, rung 1) does the same: live colour tokens on the hero container, no font import, so the live font chunk never appears in the `/` network log. One change made in WS01: the Broadcast tile's live-dot pulse is infinite and gated only by `prefers-reduced-motion`, which conflicts with WCAG 2.2.2 and K's no-auto-motion rule. The dot is static; the word "Live" carries the meaning. Section 6 records this as decided.

#### Why

- "Record versus tool" is a rule an engineer can apply without asking. It keeps every working surface (TD console, club rep workspace, admin queues, every form) in one look, which the Heritage tile itself says is where serif small caps get fussy.
- Heritage where trust is asked (who runs LCA, its rules, its titles), Minimal where money is asked. Baymard puts card-form distrust at 19% of checkout abandonment, so `/membership` and `/donate` do not change look mid-flow.
- Loading real heritage fonts only on six low-traffic pages is cheap. Keeping them off `/` protects the LCP ≤ 2.5 s and Lighthouse ≥ 90 budgets.
- Where judges disagreed on whether Heritage should appear on the homepage at all (Build cost said never; the others said yes), the accent-only level wins because it gives K's "both main ones" a visible place on the busiest page without a byte of font.

#### What it replaces in the brief

- §1.1 Heritage row ("accent... About, Champions and the history timeline only") and Scholastic row.
- §2.2 theme-scope row (adds `heritage`).
- WS01 Typography ("Heritage pages reuse Instrument Serif") and WS01 Frontend, Jobs, Acceptance.
- Exact text in section 5.

#### Build impact

WS01 grows by: two Fontsource packages (`@fontsource/libre-caslon-display`, `@fontsource-variable/source-serif-4`; verify both names on npm), the heritage token block and dark override, `src/styles/themes/heritage.css`, `ThemeScope` with `heritage` and the `base` reset, `HeritageLayout`, `ThickThinRule`, `Seal`, the `.small-caps` utility, the route-map unit test, the editor render test, the scope-aware gold-text guard, an axe pass on `/about`, `/governance/minutes` and `/champions` in light and dark, a CLS check on `/about` and `/governance/bylaws`, and a test that the heritage chunk is absent from the `/` network log. WS01 shrinks by: the Baloo 2 and Nunito packages, which move to WS11. No tables, no endpoints. Today's six pages get a reskin, not a redesign; their deeper About-A…D layouts stay in WS14 and WS10.

#### Alternatives considered

- Reuse Instrument Serif for Heritage (the brief): rejected, it has no small caps, text weights, tabular figures or ½.
- Load heritage fonts on the homepage for the identity or Champions band: rejected, it puts about 100 KB and a serif swap on the LCP-budgeted page for one strip.
- Heritage restyling buttons to the tile's navy small-caps 2px buttons: rejected, controls must look and mean the same everywhere.
- A second heritage-dark palette: rejected, undrawn, unverified by axe, and nobody owns its upkeep.
- A new `/history` route: rejected, it adds IA; the timeline lives inside About and Champions.
- Heritage on `/membership` tier cards: not taken by default, put to K (section 6).
- Dropping Bright Scholastic: rejected, K never rejected it; deferring costs nothing.

---

### Q2. Desktop header: H1 base, H4 search, H5 event strip for involved people

#### The header (1024px and up)

One navy `#1a2744` row, 68px at rest, sticky. After 80px of scroll it condenses to 56px and the rook mark replaces the logo (D1).

- **Brand:** the official full-colour logo on a 44px cream `#fbfaf6` plate (D1: the logo sits on white or cream and is never recoloured) beside "Louisiana Chess" over "Association". From 1024 to 1279px the two text lines hide and the logo stays. The brand link is always `aria-label="Louisiana Chess Association, home"`, and the image inside it, logo or rook mark, is `aria-hidden`. Section 6 asks K to check the cream plate by eye.
- **Sections:** Tournaments · Clubs · Scholastic · News · Membership · About ▾, 15px/500, 44px targets, all from `src/lib/nav.ts`. The current section is light gold `#e6cf86` (9.62:1) with a 2px gold underline and `aria-current="page"`. One label per destination, everywhere: `nav.ts` holds one entry per URL with one label, and the header, sheet, tabs, footer, trust line and search Popular list all read it. So "Board & regions" (never "Board"), and "Bylaws & rules" (`/governance/bylaws`) and "Minutes" (`/governance/minutes`) as two links, never a merged "Bylaws & minutes".
- **About** opens on click with a caret, sets `aria-expanded`, works with Enter, Space, Esc and arrow keys, and closes on an outside click. Rows: About LCA, Board & regions, Bylaws & rules, Minutes, Annual meeting, Champions, Contact. The current row gets the `#f3eedc` tint, its title in navy 600 and a "You are here" label at 13px/600 in `#705718` (5.6:1 on `#f3eedc`); H1's `#866a1e` at 12px is 4.41:1 there and fails AA, so it is not copied. Footer row: "LCA on Facebook ↗" (keeps the header Facebook link, rule 0.1.4). No Facebook icon in the bar itself; the bar is already full at 1024px.
- **Search trigger** (H4 reconciled), 16px left of the utilities, outside the utility trio:
  - 1024–1279px: a 44px-tall button with a magnifier and the visible word "Search".
  - 1280px and up: a 220px field-styled button reading "Search" with a "⌘K" key hint ("Ctrl K" on Windows and Linux; the hint is `aria-hidden`).
  - Underneath it is an `<a href="/search">`, so it works without JavaScript. Enhanced, it opens the search panel (Q5) anchored under the bar. `aria-keyshortcuts="Meta+K Control+K"`.
  - The word "Search" is visible at every desktop width because K asked for H4; a bare icon would hide the pick.
- **Utilities,** fixed order on every page: **Donate · Log in · Join LCA** (gold fill, navy text). Signed in: **Donate · My LCA ▾**, and Join LCA hides for active members. Within 30 days of expiry, or once lapsed, a gold **Renew** takes the Join slot (`members.membership_expiry` exists today).
- **My LCA ▾** carries the same to-do count as the phone tab (a navy-on-cream pill from `src/lib/todo.ts`, accessible name "My LCA, 2 things to do"), so a person sees one signal on every device. The menu holds: the to-do items first ("Finish payment · Paul Morphy Open", "Renew membership"), then My LCA (dashboard), the active event line while event mode is on ("Paul Morphy Open · My board"), Family, Membership card (WS12), then Workspace / Admin / Board inbox / My region's clubs by role (from the existing `useAccountLinks()` and `roles.ts`), then Log out.
- A `--header-h` CSS variable, updated by a `ResizeObserver` over the sticky chrome, feeds `scroll-padding-top`, so a focused control is never hidden under the header (WCAG 2.4.11). It measures every sticky element in the top stack: `AnnouncementBanner` when it is sticky, the header, and the strip in round states. Z-order, top to bottom: the search panel and menus, the header, the strip, `AnnouncementBanner`.
- Width budget at 1024px (976px content width): logo plate 44 + six sections at about 96px each (576) + the Search button with its word at about 100 + Donate · Log in · Join LCA at about 250 with their gaps, roughly 985px, which is over. So from 1024 to 1279px the section padding drops from 12 to 8px a side (6 × 88 = 528) and the utility gap from 16 to 12px, bringing the row to about 930px with roughly 45px spare. These are estimates to be measured on the preview; AC1 tests the result at 1024, 1280 and 1440px.
- Under `.dark`: the header stays `#1a2744`; the About and My LCA menus use `--popover` (`#1a2744`) with `#e8ecf4` text and the current row at `rgba(255,255,255,.1)`; the strip's light tint becomes `#1a2744` with `#e8ecf4` text and a 1px `#c8a94a` rule, and its live tokens are unchanged. Nothing is invented at build time: every colour here is a WS01 token (table in section 5.5).

#### The event strip (H5, personalised)

**Who sees it.** A signed-in person involved in an LCA-run event (a `tournaments` row with no `registration_url`; verify against the data) inside its window:
- a registered player (not withdrawn; waitlisted players see their position),
- the guardian of a registered dependent (`members.guardian_id`),
- the event's TDs (`tournament_directors`),
- `lca_admin`, for every LCA event, in every phase. K named admins explicitly; with a handful of events a year this is no noise.

Not shown: the public, signed-in members with no part in the event, `lca_observer`, `lca_officer` and `lca_auditor` (they open the event page; section 6 offers a "View only" variant), partner events ever, and checkout pages. On `/tournaments/:id/pairings` the strip drops the Pairings link and keeps My board; on `/tournaments/:id/standings` it drops the Standings link.

**Window and phases.** `eventEnd(t) = (t.end_date ?? t.date) + ' 23:59'` in America/Chicago (`end_date` is NULL for one-day events, and "+ 48 hours" always counts from that anchor). The strip runs from 6 days before day 1 at 6:00 AM Central until `eventEnd + 48 hours`. The phase is one value of `'week' | 'dayBefore' | 'checkin' | 'eventDay' | 'roundPosted' | 'roundInProgress' | 'between' | 'final' | 'after'`, computed by the pure function in `functions/utils/eventMode.ts`:
- `week`: from 6 days before day 1 at 6:00 AM until the day before.
- `dayBefore`: the calendar day before `date`.
- `checkin`: on a day in `date`…`end_date`, from 6:00 AM until the first `round_schedule` time of that day (after WS07: until that round's `round_publications` row).
- `eventDay` (Phase 0 only): after that time until 11:59 PM. The strip reads "Today · Paul Morphy Open · Round 2 at 2:30 PM" from `round_schedule` (the next round time of the day; "Rounds are under way" when none remains), [Event details] · Pairings. Once WS07 ships, this phase is never produced.
- `roundPosted`, `roundInProgress`, `between`: WS07 only, from `round_publications` and `live_state` (`eventStripLive`).
- `final`: `tournaments.status = 'completed'`, or `computeStandings` shows a non-null result in every section for the last scheduled round. The second half is the same predicate the RESULTS hero uses, so the strip and the homepage agree.
- `after`: from `final` until `eventEnd + 48 hours`. The TD's "Send the rating report" line shows in `final` and `after` while the event is not yet marked completed. The admin "not marked completed after 3 days" nudge needs `live_state = 'finished'` and moves to WS07.
Unit tests cover midnight, DST, multi-day events, `end_date` NULL, a last round finishing after midnight and the switch from `checkin` to `eventDay` on each day.

**Look.**
- Before the event, during check-in, through a Phase 0 event day and after the final: a light gold tint `#fbf7e9` with navy text and a 1px `#866a1e` bottom rule, 52px tall. It scrolls away with the page.
- While a round is live (pairings posted, in progress, between rounds): `data-theme="live"` tokens (`#0e1526` ground, `#f3f5f9` ink) with a 2px gold top rule to separate it from the navy bar, and a "Live · Round 3" tag in `#ff4757` with dark `#070b14` text. Type stays Geist; Barlow never loads here. In these states only, the strip is sticky with the bar (44px when the bar condenses). This is K's "distinct theme to show that stuff is live", and it reconciles two judging panels: the look panel kept Broadcast off the strip, the header panel put it on; tokens-only, round-states-only honours both the scope rule (no new fonts, no new surfaces) and K's note 1.

**One line, left to right:** status tag in words · event name (a link) · the viewer's sentence · primary button · secondary links · a 44×44 Hide button. Times are absolute ("starts 7:00 PM"). There is no ticking countdown; nothing auto-updates visibly. Round-state lines carry "Updated 6:41 PM" from `round_publications.published_at`.

**Per role, per moment:** section 3 is canonical, and the lines below quote it. Highlights:
- Player, event week: "This week · Paul Morphy Open · Sat–Sun, Jun 12–13 · You're in the Open section · Bye: Round 4, ½ point · Entry paid" [Event details] · Something wrong? Tell the TD. Unpaid: "Payment not finished · $40" [Finish payment]. Waitlisted: "You're #2 on the waitlist".
- Player, check-in: "Today · Paul Morphy Open · Check in at the desk before Round 1 at 10:00 AM · Not checked in yet" or "Checked in 8:52 AM". This matters: `generate-pairings` skips unchecked players when `onlyCheckedIn` is set. The copy says "Check-in 8:30–9:30 AM" only once a check-in window field exists (WS05/WS08); today `round_schedule` holds round times only.
- Player, round posted (WS07): "Live · Round 3 of 5 · Board 6 · White vs Priya Shah · starts 7:00 PM · Updated 6:41 PM" [My board] Pairings · Standings. Bye: "Round 3: ½-point bye". Section not yet paired: "Round 3 pairings aren't posted yet for U1400".
- Guardian: plain sentences for up to two children ("Maya plays White on board 6 · Theo plays Black on board 14"), then "3 of your players are paired" [See boards]. A guardian sees only their own dependents.
- TD: the next step, never a copy of the player view: "Live · Round 3 · 14 of 30 results in · missing boards 2, 9, 14" [Enter results]. Every TD and admin line ends with "Players see: Round 3 in progress", built by running the same copy builder with the player role. One fix-it line ships in Phase 0 because it reads existing data: "Round times missing: players see 'time to be announced'" → Add round times. Richer fix-its belong to WS08.
- Admin: the TD line with the same [TD console] button. Under D6 an admin opens the same console a TD does; there is no separate admin console. One label per destination: "TD console" on the strip and bar for TDs and admins alike, "Open TD console" on banners, and "Open check-in" only while the console deep-links to its check-in step.
- "Something wrong? Tell the TD" opens the existing support form (`/api/support`) prefilled with the event name and the signed-in person's name and email; the ticket is tagged with the tournament id so the TD console (WS08) and the admin queue can route it. No personal email address is ever shown: `tournaments` has no contact column, and TD addresses on `members` stay private. (The `unknown@unknown.com` placeholder belongs to the US Chess-lookup auto-ticket in `UscfSearchInput.tsx`, not to the form, which takes name and email.) If K wants a per-event address later, WS05 can add an optional `contact_email` column.

**Rules.**
- Exactly one strip per person. Precedence when one person holds several roles on one event: TD, then admin, then player, then guardian. When a person is involved in two LCA events inside their windows, the strip shows the event whose next moment is sooner (`nextRoundStart`, then `date`); the other appears only as a second line in My LCA ▾ and on the My LCA page. The same rule picks the one event for the phone bar and banner. Other roles are reached through "+1 more" in My LCA.
- The strip never carries Join, Donate or any upsell.
- Results are words ("Won", "Draw · ½"), never "1–0".
- `<section aria-label="Your event: Paul Morphy Open">`. One persistent visually hidden `role="status"` node announces state changes only ("Round 3 pairings posted. Board 6, White."), never on first render, never on an unchanged poll, and never moves focus. TD counts that change between polls are not announced. On phones, when a banner (itself a status region) is inserted, this node stays silent; it speaks only when the banner is held back and the bar shows "New", so nobody hears a round twice.
- On a failed poll the strip keeps its last payload and its "Updated" time, retries with backoff (5 s, 20 s, 60 s), and hides only after three consecutive failures in a round phase. It never shows an error; My LCA carries the retry.
- **Hide:** the X is labelled "Hide until the next update". It hides the strip for its state key (`event:phase:round`), stored in `localStorage` inside try/catch; if storage throws, the strip shows. A new round always brings it back. While hidden, the event stays as the first line of My LCA ▾. One dismissal model for every role and every surface: the desktop strip, the phone bar and the Menu sheet's "Hide event bar until the next update" item all use this label and write this key; nothing hides on a timer or "until tomorrow". WCAG 2.2.2 requires a way to hide self-updating content, so this control is mandatory.

**Public during a live LCA round.** No strip. The Tournaments nav item gets a text tag "Live" (`#ff4757` fill, `#070b14` text; accessible name "Tournaments, 1 event live now"), `/tournaments` pins the event, and the homepage hero goes live. On the event's own pairings and standings pages, above the Find-your-name field, signed-out visitors see "Playing today, or is your child? Find your name in the pairings below, or log in to see the board." (the link goes to `/login` with `from` set). It ships in WS07 behind `eventStripLive`, only for `tournaments` rows with no `registration_url` while `/api/live/now` names that event; a role-safety test asserts it never renders for a partner event. Find-your-name is the door for guest entrants (WS06), who have no account. The brief's public slim bar is dropped. Section 6 puts this to K.

#### API

- **`GET /api/me/event-mode`** (new, `requireAuthedMember`, `Cache-Control: private, no-store`, ETag with 304). It supersedes the boards' `/api/me/live-board`. The contract is the `EventModeResponse` interface in section 5.5, shared through `functions/utils/apiTypes.ts`: one item per event with `viewer`, the nine-value `phase` above, `round`, `roundsTotal`, ISO-8601 times with the Central offset, the viewer's `players` rows (own entry, or one per dependent), the TD block with its counts and typed fix-its, `playersSee`, the dismissal `key` (`${tournamentId}:${phase}:${round ?? 0}`) and `pollSeconds` (20 or 300). Or 204.
- Phase 0 data all exists: `registrations` (`payment_status`, `withdrawn_at`, `waitlisted_at`, `checked_in_at`), `members.guardian_id`, `tournament_directors`, `tournaments` (`date`, `end_date`, `status`, `round_schedule`, `registration_url`), and `/api/me` already returns own and children's registrations plus `directedTournaments`.
- Round and between phases key off WS07's `round_publications`. Today `tournament_games` rows are public the moment pairings are generated and rounds can be deleted and re-paired, so a "posted" line before WS07 could show a player the wrong board. When WS07 lands, the switch is one predicate in `functions/utils/eventMode.ts`.
- The phase computation is a pure function in `functions/utils/eventMode.ts` with unit tests across midnight, DST, multi-day events and `end_date` NULL (America/Chicago via the existing `functions/utils/time.ts`).
- The client calls the endpoint only when `/api/me` already shows an entry, a dependent's entry, a directed event or `lca_admin` inside a window. For that gate, `functions/api/me.ts` adds `t.end_date, t.registration_url, t.is_visible, t.registration_status` to each registration row and `end_date, registration_url` to `directedTournaments` (today it returns `tournament_date` and `id, name, date, status` only, which cannot place a multi-day event or exclude a partner row). Everyone else sends nothing. Polling (D7): every 20 s while the tab is visible during the check-in, event day, round and between phases; every 5 minutes otherwise; never while the tab is hidden.
- **`GET /api/live/now`** (WS07, public, edge-cached 30 s) drives only the public Live tag, the Popular list's "Live now" row and the homepage live hero. It is live while `live_state = 'live'` and the next round in `round_schedule` starts today (America/Chicago), and off from the last published round's results-complete time until the next round's day; that one predicate also decides the public Live tag between rounds.
- Integration tests in the `role-safety` style: a guardian sees only their own dependents; a TD of another event sees nothing for this one; a plain member gets 204; partner events are never returned; TD counts never reach a player.

#### Why

- Visible nav and a fixed utility order follow NN/g and WCAG 3.2.3 and 3.2.6. One row keeps the bar inside the 1024px width budget.
- Personalised lines from one source, plus the "Players see" echo, deliver K's "everyone involved can see it and can see it had the correct info".
- Keeping the strip from the public avoids banner blindness for the majority, while the Live tag and home hero keep check 9 (pairings one tap from the homepage).
- Absolute times, no countdown and a hide control keep the strip clear of WCAG 2.2.2.

#### What it replaces in the brief

WS02 "Event mode" bullet (public slim bar, per-session dismissal), AC4, the `EventBar.tsx` file (renamed `EventStrip.tsx`), the search bullet (two-row H4, the "/" shortcut), and the About menu's missing Facebook row. §1.2 Header row. Exact text in section 5.

#### Build impact

WS02: rewrite `Navbar.tsx` around `nav.ts`; new `SearchTrigger.tsx`, `AboutMenu.tsx`, `MyLcaMenu.tsx`, `EventStrip.tsx`, `LiveTag.tsx`, `useEventMode.ts` (one poller shared with the phone dock), `src/lib/eventModeCopy.ts` (one copy builder for strip, dock and banner, tested for ½, weekday and "7:00 PM"), `functions/api/me/event-mode.ts`, `functions/utils/eventMode.ts`. Flags: `newNav`, `siteSearch`, `eventStrip` (week, day before, check-in, event day, final and after: Phase 0), `eventStripLive` (round posted, in progress and between, the public "Playing today" line and the admin "not marked completed" nudge: WS07), `liveMarker` (public Live tag: WS07). The H5 round-alert bell is hidden until WS07's email alerts exist (D8).

#### Alternatives considered

- H4 literally (two rows, sections on a white second row): +46px on every page, about 174px of sticky chrome with the strip; the homepage box answers the visible-search evidence instead.
- The brief's public slim bar, or a 36px public live line: a third live surface for people who are not involved; K scoped event mode to involved people.
- Ticking "in 19 min" countdown: not taken by default. The Hide button already satisfies WCAG 2.2.2, so this is a design choice: it repeats the absolute time and adds anxiety. Section 6 puts it to K.
- `MIN(tournament_games.created_at)` as a pre-WS07 "posted at": a re-pair would show wrong boards, exactly the wrong info K asked to avoid.
- TDs and admins unable to hide the strip: fails WCAG 2.2.2.
- A Facebook icon in the bar at 1280px: eats width where AC1 is already tight; the About row and footer keep every link.
- Dropping the condensed header: contradicts D1's rook-mark swap and gives up a cheap 2.4.11 mitigation.
- Excluding admins from event week: contradicts K's note.

---

### Q3. Mobile: M2 tab bar plus M4's banner and docked bar

#### Breakpoints

- **Under 768px:** app bar plus the M2 tab bar (this section).
- **768–1023px:** the brief's hybrid header, built from the same header component: rook mark + "LCA", Tournaments and Clubs inline, the Search button, a "Donate" text link, Log in or My LCA ▾ (with the to-do count), and a bordered "Menu" button that opens the same sheet as a 400px right drawer. With only two sections inline there is room for Donate at 768px, so Donate stays one click on tablets. Event mode uses the desktop `EventStrip` as one 48px line: status tag · event name · the viewer's sentence (truncated, with the full text in `title` and in My LCA) · primary button · the 44×44 Hide button; secondary links and the "Players see:" echo move into My LCA ▾ on tablets. No tab bar, so the bottom edge stays free for the WS08 TD console's action buttons on portrait tablets.
- **1024px and up:** the Q2 desktop header.
- **Landscape under 480px tall, or zoom that drops the viewport under 300 CSS px:** one media query hides the bottom stack and makes the app bar non-sticky; the app bar shows M1's bordered "Menu" button instead (WCAG 1.4.10 reflow).

#### App bar (56px, navy, not sticky-condensing)

Left: the rook mark (D1, tight space) and "Louisiana Chess" over "Association" at 14px/11px, as M2 draws it; tapping it goes home. Right: a 44×44 bordered Search button, `aria-label="Search"`, which navigates to `/search` (a real page, so Back works and the on-screen keyboard never fights a modal). When the Menu tab is current (Scholastic, News, Membership, About pages), the current section name shows in light gold `#e6cf86` between brand and Search, derived from the route config.

#### Tab bar

`<nav aria-label="Main">`, fixed bottom, white, 1px `#d9d8d1` top border, **56px plus `env(safe-area-inset-bottom)`**. `index.html` gains `viewport-fit=cover` (it has only `width=device-width, initial-scale=1.0` today). Four equal tabs, each the full bar height and at least 44×44 (Start-Principles check 36), a 20px icon over a 12px/500 label. Labels always show.

1. **Tournaments** (calendar icon). The same word as desktop, from `nav.ts`. M2's "Events" is dropped: one word everywhere, one nav config, WCAG 3.2.4. At 12px it is about 77px against an 80px tab at 320px wide; under 360px the label drops to 11px, the word never changes.
2. **Clubs** (map pin).
3. **Log in** when signed out (person icon), rendered as `<Link to="/login" state={{ from: location.pathname + location.search }}>`, because `LoginPage.tsx` reads `location.state.from` and falls back to `/dashboard` (it does not read a `?next=` parameter, and it is not changed). The Menu sheet's Log in button and the desktop Log in link pass the same `from` state, so every width returns the person to the page they were on. **My LCA** when signed in, opening `/dashboard`, with a count badge. Same position and icon in both states.
4. **Menu** (three lines). Opens M1's sheet; the tab reads "Close" with `aria-expanded` while open. Menu shows as current on pages whose section has no tab.

Current tab: bold navy label, a 3px bar on its top edge in gold-ink `#866a1e` (5.13:1 on white; brand gold `#c8a94a` is 2.28:1 there and stays on the navy header's underline only), `aria-current="page"`. Never colour alone. The bar never auto-hides on scroll. The tab bar joins the scope-aware gold guard.

**The login page** (signed-out tab) says above the form: "Log in to see your registrations, your children's boards on event days, and your membership." Below: [Create an account] and "You don't need an account to browse tournaments or find a club." Forced accounts cause 18–24% of abandonment (Baymard); the reassurance is cheap.

**The count badge** counts personal to-dos only: unpaid, unwithdrawn entries for yourself or your children for events whose `eventEnd` is still ahead; an LCA membership that is `active` with `membership_expiry` within 30 days, or `expired` (a past paid membership), never `pending` or a NULL expiry, because `membership_status` defaults to `pending` and a permanent badge on every parent and scanner user would teach people to ignore it; a US Chess membership that ends before an event you entered (`members.uscf_expiration`, migration 0042). `todo.ts` has a unit case per membership status. It is computed on the client in a pure, unit-tested `src/lib/todo.ts` over the existing `/api/me` response, fetched on load and on window focus, never polled. Volunteer queues never feed it (an admin with 14 queue items would learn to ignore a permanent badge); they get their own counts inside My LCA. Event-day items never count; the event bar covers those. Navy pill, white 11px/700 numeral, capped at "9+", hidden at 0 and while loading. Accessible name "My LCA, 2 things to do".

#### Menu sheet (M1)

A modal `Sheet` on the existing Radix dialog (`src/components/ui/dialog.tsx` exists; add `ui/sheet.tsx` through the shadcn CLI), full height above the tab bar. Focus is trapped; Esc or Close returns focus to the Menu tab. It slides only when reduced motion is not set. Contents, in order:
1. the six sections, with the current one expanded and marked "You are here" (13px/600 in `#866a1e` on the sheet's `#fbfaf6` row, 4.91:1). Scholastic carries the sub-line "Kids and school chess". Tournaments holds All tournaments and Scoresheet scanner in Phase 0; "This weekend" (`/tournaments?when=weekend`) appears only once WS04 ships its URL filters, and "Results" (`/results`) only once WS10 ships the route, each gated on the same flag as its route, so the sheet never holds a dead link.
2. **Donate · Log in / My LCA · Join LCA**, in the desktop order (Renew when it applies).
3. Workspace / Admin / Board inbox by role.
4. Facebook ↗ · Contact · Website help.
5. The System / Light / Dark switch, a shortcut to the same control in the footer base line (the footer exists at every width, so desktop and tablet users can choose too). The choice is stored in `localStorage` inside try/catch and defaults to System.
6. While event mode is on: "Hide event bar until the next update". It writes the same `event:phase:round` key as the bar's own Hide button; there is no time-based mute.

Donate is therefore two taps on phones (Menu, then Donate; it is the first of the three buttons after the section list). That breaks "Donate is one click from every page" as the brief writes it in both WS02 AC6 and WS12 AC6; section 5 rewrites both to apply to tablet and desktop, with the phone exception. Section 6 asks K.

#### The bottom stack (BottomDock)

DOM order on every width: the app bar (or header) first, then a "Skip to content" link as the first focusable element on the page (the audit found none; WCAG 2.4.1), then `<main>`, then the `BottomDock`, so the tabs come after the content for keyboard and screen-reader users; the Menu sheet is portalled after the dock. One container holds every bottom-fixed element, in slots: the page action bar (WS05's "Register · from $30" mounts here later), the event bar, then the tab bar. A `ResizeObserver` writes `--bottom-chrome-h`, which drives both `<main>` `padding-bottom` and `html { scroll-padding-bottom }`, so nothing is ever covered and a focused control is never hidden (WCAG 2.4.11). Only one contextual bar shows at a time: the event bar outranks the Register bar on that event's own days (registration is closed by then anyway). The whole stack hides while the on-screen keyboard is open (`visualViewport` shrinks by more than 150px; fallback: any text input focused), and on routes that declare `hideTabBar` in `nav.ts`: `/tournaments/:id/register`, checkout and success pages, the Stripe hand-off, scanner capture, the TV view and print. A Playwright test asserts that no fixed element's bounding box overlaps `<main>` content at 320, 360, 390, 768 and 1023px.

#### Event mode on phones

**The event bar** (M4's pill, docked). A 56px full-width row attached directly above the tab bar inside the stack. Not floating, not replacing a tab, not a Live tab: swapping My LCA for "Live" would change a repeated navigation control mid-event (WCAG 3.2.3) and hide the to-do count.
- Two lines, full words, never "R3" or "Bd 6": "Live" tag · "Round 3 · Board 6 · White" over "vs Priya Shah · starts 7:00 PM" · chevron. The whole row is one link to My board. At the right, a separate 44×44 × labelled "Hide until the next update", stored per `event:phase:round`, the same label and key as the desktop strip.
- Light tint during check-in, through a Phase 0 event day and after the final, live tokens in round states, as on desktop.
- Guardian: "Maya: board 6 · Theo: board 14", truncating to "+1" with the full list one tap away. TD: "Round 3 · 14 of 30 results in" → Enter results. Admin: "Round 3 · 14 of 30 results in · Players see: in progress" → TD console. Check-in: "Check in at the desk before Round 1 at 10:00 AM · Not checked in yet". Final: "Final · 3½ of 5 · 4th in Open" → Standings.
- It shows from check-in on day 1 until `eventEnd` + 48 hours (Q2), for involved people at LCA-run events only. Event week lives as a card at the top of My LCA and on Home, not as a week of persistent chrome. It is hidden on that event's own pairings and standings pages, where the pinned "Your game" card does the job.
- When a banner is held back (below), the bar gains a text tag "New" and the status region announces the change.

**The top banner** (M4). An in-flow card under the app bar with `role="status"`, 44px buttons, never fixed, never over content. It appears once per state key per device, only when something new happens for this viewer: check-in opens; "Check-in closes in 30 minutes" for an involved player not yet checked in (needs a check-in window field, so WS05 or later); their round's pairings are posted; final standings. It is inserted only on page load, route change or when `scrollY` is under 100; if the reader has scrolled, the banner waits for the next page view and the bar shows "New" instead, so nothing jumps (CLS). A Playwright test posts a new round mid-scroll and asserts no layout shift.
- Player: "Round 3 pairings are posted · 6:41 PM" / "You're on board 6 with White against Priya Shah. Round 3 starts at 7:00 PM." [Open my board] [Dismiss]. Opening pairings also dismisses it.
- Guardian: one sentence per child, plus a first-time link "New to tournament days? What to expect".
- TD: "Round 3 pairings are posted · 30 boards · 0 of 30 results in" [Enter results]; later "All Round 3 results are in" / "Pair Round 4 when you're ready. It's set for Sun 9:30 AM." [Open TD console].
- Admin: the TD banner with [Open TD console] and "Check what players see". K named admins among the people who should see the pop-ups, so admins get them; two judges would have given admins the bar only, but with three to six events a year and a Dismiss button the cost is small and K's words are explicit.
- Dismiss ("Dismiss: Round 3 pairings") stores the state key. Nothing runs on a timer. The banner is a live region itself, so the dock's status node stays silent when a banner is inserted and speaks only when the banner is held back (the "New" tag case).

Partner events never get the bar or the banner. Both read the same `/api/me/event-mode` hook and `eventModeCopy.ts` as the desktop strip, under the same flags (`eventStrip`, `eventStripLive`). No phone-only event flags.

**Under `.dark`:** the app bar stays `#1a2744`; the tab bar and event bar are `#111a2c` with a `rgba(255,255,255,.08)` top border, labels `#9aa6bf`, the current tab `#e8ecf4` with its 3px bar in brand gold (a fill on a dark ground); the banner card is `#111a2c` with the border token; the sheet uses `--popover` (`#1a2744`). All of these are WS01 tokens (table in section 5.5), and WS02's axe run covers the dark state with the strip and the tab bar mounted.

#### Why

- Combo or visible mobile nav is used 86% of the time versus 57% for hidden menus (NN/g), so permanent tabs fit. One label set across sizes satisfies WCAG 3.2.4 and the single `nav.ts`.
- The docked bar solves the collision the boards never drew, in one mechanism that also serves WS05's sticky Register bar.
- In-flow banners that insert only at load protect the reader's place and CLS; the "New" tag and polite announcement cover people who stay on one page.
- Bottom chrome during rounds is 56 + 56px plus the safe area, roughly 17% of an iPhone SE screen. That is acceptable for event days only and must be checked on real phones at the pilot event.

#### What it replaces in the brief

§1.2 Mobile nav row ("M1 Combo with M4's pill"), WS02 "Mobile (< 1024 px): combo bar" and the md–lg sentence, AC3 (extend to the sheet from the tab), AC6 (Donate), and adds `viewport-fit=cover`. Exact text in section 5.

#### Build impact

WS02: `MobileAppBar.tsx`, `BottomTabs.tsx`, `BottomDock.tsx` (slots, context, `--bottom-chrome-h`), `MobileMenu.tsx` (Radix sheet), `EventDock.tsx`, `EventBanner.tsx`, `src/lib/todo.ts`, `nav.ts` gains `icon`, `tab` and `hideTabBar`. `Navbar.tsx`'s hamburger drawer goes. Playwright is not in `package.json` today; adding it is already part of WS01's cost. Flags: `newNav` covers phones too; there is no separate `mobileTabBar` flag, so the moment the new header ships, phones get the app bar, tab bar and sheet, and no flag combination leaves a phone without navigation. `LoginPage.tsx` is unchanged. Plus Q2's event flags.

#### Alternatives considered

- M4's floating pill over content: covers list rows and the Register bar, needs 100px of dead padding, obscures focus.
- My LCA turning into a Live tab: changes a repeated control mid-event; hides the badge.
- Tab bar on tablets, dropping the hybrid tier: looks app-like at 1000px and puts tabs under the TD console's bottom actions.
- A non-dismissible event row: fails WCAG 2.2.2.
- Abbreviated one-line copy ("Live · R3 · Bd 6"): breaks the plain-language rule.
- "Check-in not done" in the badge: double-signals the bar and goes stale when check-in closes.
- A server-side todos field or endpoint: every input is already in `/api/me`.
- Event-week banners or a week-long bar: teaches people to ignore chrome before the day it matters.

---

### Q4. Homepage hero ladder

#### Principles for every mode

- `selectHeroMode(now, data)` is a pure function in `functions/utils/homeHero.ts`, run on the server in `/api/home` in America/Chicago time (`LCA_TIME_ZONE` in `functions/utils/time.ts`). The first rung whose trigger matches wins; a rung missing its data falls through. No mode ever renders an empty frame.
- "LCA event" means a visible `tournaments` row with no `registration_url`. "Partner" means a `clearinghouse` row, Louisiana only (`state = 'LA'`; `is_lca = 0` is already filtered). Out-of-state Gulf South events never take the hero; they live on `/tournaments` and in search.
- Registration state is four predicates in `functions/utils/events.ts`, used by `/api/home`, `/api/search` and the strip's "Finish payment" line alike, each with its own unit test: `isOpen(t) = t.is_visible = 1 AND t.registration_status = 'open' AND (t.registration_closes_at IS NULL OR now < t.registration_closes_at) AND (t.registration_deadline IS NULL OR now < t.registration_deadline)`; `isFull(t) = t.max_players IS NOT NULL AND count(registrations WHERE withdrawn_at IS NULL AND waitlisted_at IS NULL) >= t.max_players`; `isClosedOnline(t) = t.is_visible = 1 AND NOT isOpen(t) AND (t.registration_status = 'closed' OR registration_closes_at or registration_deadline has passed) AND now < eventEnd(t)`; `isAnnounced(t) = t.is_visible = 1 AND NOT isOpen(t) AND NOT isClosedOnline(t) AND (t.registration_opens_at IS NULL OR t.registration_opens_at > now)`. Today's HomePage, TournamentsPage, AgendaList and ScholasticPage all gate on `registration_status === 'open'`, so `isOpen` matches them. `eventEnd(t) = (t.end_date ?? t.date) + ' 23:59'` in America/Chicago, the same helper Q2 uses.
- One `EventAction` component is the only place that renders Register versus "Registers on the organizer's site ↗". Any `tournaments` row with a `registration_url` is treated as organizer-registered everywhere. A unit test asserts that a partner row never renders Register or a count, and an `/api/home` fixture with partner-only data asserts no "Register" text and no count.
- Partner rows are hidden when the newest `clearinghouse.synced_at` is more than 3 days old or their `start_date` has passed. LCA rows never depend on the sync: a stale feed drops partner rows from a rung, the rung still matches on its LCA rows, and only when nothing is left does the ladder fall through. An admin alert is raised (a line in the existing `workers/daily-emails` run until WS08's queue exists). A cancelled partner event on the front page creates the support email admins cannot answer.
- Lines whose data is empty (`early_deadline`, `round_schedule`, a partner's city or format) are dropped, never printed as placeholders.
- Exactly one gold primary action per mode. Every date carries its weekday. Status is in words.
- The single static photo is `src/assets/LCA_Slide_1.jpg` through the WS01 image pipeline (`<picture>`, AVIF/WebP, ≤ 200 KB at 390px, a 96px strip on phones), alt text "Players at long tables in a tournament hall", unless K supplies one photo and its alt text. It appears only on LCA-run modes. Partner and quiet modes use the a–h / 8–1 grid motif at 0 KB; a partner event should not wear LCA's hall.
- Every non-LCA mode ends with a **Next LCA event** line when one is announced within 180 days: "Next LCA event: State Scholastic Championship · Sat, Apr 10 · Registration opens Fri, Jan 15 ›", with status in words: `isOpen` → "Registration open ›"; `registration_opens_at` set → "Registration opens Fri, Jan 15 ›"; otherwise "Details ›", with no date invented. If none is announced the line is omitted.
- Personalisation is applied on the client after the cached shared response, so personal data never enters the edge cache. "You're entered · Open" with primary "Your entry" in the register modes, and "You finished 4th" in results, come from `/api/me` registrations; board, colour, opponent and a guardian's children's boards come from the shared `useEventMode()` hook (`/api/me/event-mode`), so the hero and the strip never disagree. This is how the homepage honours K's "everyone involved sees correct info".
- Loading and failure: while `/api/home` loads, the hero reserves a fixed min-height per breakpoint (360px at 390px, 440px at 1280px) with a neutral skeleton, so CLS stays under 0.1. If the fetch fails or times out, the hero renders the CLUBS floor from the static `regions.ts` with no error chrome; the lower blocks keep the current page's honest error states.
- The clubs' free-text `meeting_schedule` is never parsed into a "Tonight" panel before WS09. A wrong meeting time sends a parent to a locked door.

#### The ladder (first match wins)

1. **LIVE** (WS07, flag `homeLive`). Trigger: an LCA event has a published round (`round_publications`) and is not finished. Content, with the live colour tokens on the hero container only (`data-theme="live"` with the font import skipped, so type stays Geist and the live font chunk never loads on `/`), no photo: "Live · Round 3 of 5" tag, event name, the plain sentence "Players are in round 3 in New Orleans. Pairings show who plays whom on each board.", "Round 3 pairings posted 6:41 PM · starts 7:00 PM", a Find your name field, a round progress row as `<ol aria-label="Rounds">` in words ("Round 1 · Final", "Round 2 · Final", "Round 3 · Live", "Round 4 · Sun 9:30 AM", "Round 5 · Sun 2:00 PM"; at 390px, under a visible "Rounds" heading, the compact items "1 Final · 2 Final · 3 Live · 4 · 5" with the word "Round" visually hidden in each; never a dot without its word, never "R3"), "Updated 6:42 PM" and a **Pause updates** button (WCAG 2.2.2; polls every 20 s, none while hidden). Signed-in involved viewers see "You're on board 6 with White". Primary: Find my board. Secondary: Pairings · Standings · Event page.
2. **EVENT DAY** (Phase 0, until WS07). Trigger: today falls between an LCA event's `date` and `eventEnd` (`end_date` NULL means a one-day event). Content: "Today · Louisiana State Championship · Sulphur · Round 1 at 10:00 AM" from `round_schedule` (line dropped if empty). Primary: Event details. Secondary: Pairings (the page exists today). This closes the gap where a closed registration would otherwise drop LCA's own event day to a partner or quiet hero.
3. **REGISTER, LAST CALL.** Trigger: an LCA event that is `isOpen` or `isClosedOnline` starts within 14 days, or its `early_deadline` is within 7 days. Home-A's full card (below), with the primary set by registration state. This outranks RESULTS because unpaid and late entries are what TDs chase by email.
4. **RESULTS.** Trigger: an LCA event with `eventEnd` within the last 7 days, `status = 'completed'`, and every section has at least one `tournament_games` row with a non-null result in its last scheduled round (the same predicate as the strip's `final` phase, read through `computeStandings`); a completed event with pairings but no results falls through (fixture test "completed, no results"). Once WS10 lands, the rung reads WS10's immutable `event_results` snapshot instead of live standings, so a later correction or re-entry never changes the front page. Content: Heritage accent (thick–thin rule, seal) in Geist: "Final standings · 2026 Louisiana State Championship · Sat–Mon, Sep 5–7 · Sulphur", one winner per section by full name with ½ ("Open: Marcus Landry, 4½ of 5"; "Tied for first: A, B" on ties), up to four sections then "+2 more sections", "State champion" label when `is_state_championship = 1`. Names never link to a player page (D9). Primary: Final standings. Secondary: Crosstable · LCA on Facebook ↗ (the existing brand link, rule 0.1.4; no tournament field holds an album, so a "Photos ↗" link appears only once WS10 links a recap post through `lca_posts.tournament_id`) · Recap (WS10, when linked). Builds in Phase 0 behind `homeResults`, ahead of WS10's archive; section 6 puts this to K.
5. **REGISTER.** Trigger: an LCA event that is `isOpen` or `isClosedOnline` starts within 30 days, or its `early_deadline` is within 14 days. Home-A's card: relative start and the tags "LCA event" and "Registration open"; weekday dates and city; check-in and round 1 line (when stored); rounds and time control in plain words; sections; "38 of 60 registered · 22 spots left · early entry ends Tue, Jun 1" with a fill bar; "LCA members save $10". Primary by registration state: `isOpen` → "Register · from $30"; `isFull` → "Join the waitlist"; `isClosedOnline` → "Event details" (tag "Online entry closed") until the start; already entered → "You're entered · Open", primary "Your entry". An `isAnnounced` event inside 30 days goes to rung 6 instead, so the reminder action stays with it. Secondary: Event details · Add to calendar.
6. **ANNOUNCED.** Trigger: an LCA event that is `isAnnounced` (visible, so half-made drafts never show; neither open nor closed online), starting within 60 days. Content: a large `DateBlock`, "Registration opens Fri, Jan 15" (`registration_opens_at` exists since migration 0005; without a date, "Registration not open yet", no date invented). Primary, signed in: "Email me when registration opens" (the existing `RegistrationReminderButton` and `remind.ts`). Primary, signed out: Event details, with a secondary "Add to my calendar" as a client-side `.ics` Blob that collects nothing; WS04's calendar feeds replace it. Never "Log in to get a reminder" as the primary.
7. **WEEK** (WS09, flag `homeWeek`). Trigger: club schedules exist. Content: "This week in Louisiana chess · Mon, Oct 5 – Sun, Oct 11 · 19 club meetings at 15 clubs", a Tonight panel (first five rows), the weekend's tournaments with LCA and Partner tags. Primary: Find a club tonight. Grid motif.
8. **THIS WEEK IN LOUISIANA** (Phase 0, the usual state before WS09). Trigger: Louisiana events, LCA or partner, start within 14 days. `SYNC_STALE_DAYS` applies to partner rows only: when the sync is stale the partner rows are dropped and the rung still matches on LCA rows. Heading "This weekend in Louisiana" when within 7 days, otherwise "Coming up in Louisiana". Up to three `DateBlock` rows: weekday dates, name, city, organizer, format in plain words, the tag "LCA event" or "Partner event", and "Registers on the organizer's site ↗ (opens in new tab)" on partner rows (an internal partner page once WS04 ships). Never a single partner event as a hero card: that sends the one primary action off-site and reads as LCA's own event. Under the rows: "Or play this week at one of 25+ clubs →". Primary: All tournaments. Grid motif.
9. **QUIET.** Trigger: nothing within 14 days (partner rows count only while the sync is fresh; LCA rows always). Content: h1 "Find your next game in Louisiana", the Next LCA event card (within 180 days), the three soonest Louisiana events however far away ("Sat, Oct 31 · in 23 days"), each tagged, and a clubs line with a region select from `clubs.region` (D10). Primary: Find a club near you (clubs meet every week and suit beginners and kids). Grid motif. Search is not the hero here; it sits in the band below, as in every mode.
10. **CLUBS** (the floor). Trigger: nothing above matches, which includes an empty or stale partner feed with no LCA rows in range; the client also renders it when `/api/home` fails. Content: "25+ clubs meet across Louisiana" with the seven region chips from the static `regions.ts`. Primary: Find a club. The hero is never blank and never runs on stale data.

Window constants live in `homeHero.ts`: `LAST_CALL_DAYS = 14`, `LAST_CALL_EARLY_DAYS = 7`, `REGISTER_DAYS = 30`, `REGISTER_EARLY_DAYS = 14`, `RESULTS_DAYS = 7`, `ANNOUNCED_DAYS = 60`, `NEARBY_DAYS = 14`, `NEXT_LCA_DAYS = 180`, `SYNC_STALE_DAYS = 3`. Unit tests cover every rung, every boundary, ties (earliest event wins), midnight, DST, `end_date` NULL, a stale sync with an LCA row inside 14 days, a closed-online LCA event inside 30 days, an announced event inside 30 days (rung 6), a completed event with no results (falls through), and a last round that finishes after midnight. Review the windows after one season using hero clicks per mode.

Once `FEATURES.clubTournaments` turns on, rungs 3, 5 and 6 are gated to rows with `club_id IS NULL OR is_state_championship = 1`, so club-run events cannot take the LCA hero.

#### Where the search box goes

Directly under the hero, in every mode, as part of the **identity and search band**: the official logo (D1) and "Louisiana's chess community since 1915 · 300+ members · 25+ clubs · 7 regions" (each stat a link; "300+" is the hard-coded stat), a CSS thick–thin rule (the Heritage accent), and Home-B's box (Q5) at full content width with a visible label. The band is one fixed place, so the box never moves between visits and the Home-A hero always leads. Quick-pick chips (This weekend · Scholastic · Clubs by region) stay hidden until WS04 and WS09 ship the URL filters they point at.

#### Page order below the hero (the brief's order, kept)

Identity and search band → this-week strip (WS09, flagged) → upcoming six (Louisiana only in Phase 0; the "Add Gulf South" toggle waits for WS04's filters and the "All tournaments" link covers the rest; events already in the hero removed; counts on LCA rows only) → doors band → results and champions (the Champions band ships in Phase 0 from `state_champions` and `/api/champions`, hidden when the newest title is more than 13 months old; the recap card waits for WS10) → news and `FacebookFeed` → membership band (hidden for active members). Nothing is hidden by hero mode.

#### Why

- The usual homepage is rungs 8 and 9, so they are built to be useful (real dated events, a club that meets this week, the next LCA championship) rather than thin.
- 30 days is K's "next month"; the last-call tier and early-deadline override cover the "should I hurry?" moment (Luma's count line) without pinning one event up for six weeks.
- Results outrank an ordinary registration because results are fresh for about a week and the data already exists; last call outranks results because a deadline is actionable.
- Where judges split on the quiet state (two said a search hero, one said never), the search panel's own judges were unanimous that search must not become the hero, and K picked A over B; so the quiet hero keeps next-event information and search keeps one fixed band.

#### What it replaces in the brief

WS03 "Hero with three modes", the 21-day window, AC1, AC5 (the band is part of the identity line, so the phone order is unchanged), the "Home-B search via ⌘K" line in §1.2 and WS03, and WS03's Depends on (results and champions no longer wait for WS10; `/api/events` no longer blocks WS03). Exact text in section 5.

#### Build impact

WS03: `functions/utils/homeHero.ts`, `functions/utils/events.ts` (the LCA + clearinghouse union moved out of `functions/api/clearinghouse.ts`, so WS03 ships before WS04 and WS04's `/api/events` reuses one query), `functions/api/home.ts` (edge cache 60 s, 15 s in LIVE or EVENT DAY, null blocks for unbuilt sources), `HomeHero.tsx` with one subcomponent per mode, `HeroEventCard` (lca, partner, compact), `NextLcaCard.tsx`, `EventAction.tsx`, `IdentitySearchBand.tsx`, `UpcomingList` (`excludeIds`), `ChampionsBand.tsx`, `addToCalendar()`. Delete `HeroSlideshow`. Flags: `newHome` (rungs 2–6, 8–10 and the lower blocks), `homeLive` (WS07), `homeWeek` (WS09), `homeResults` (Phase 0, own flag), `homeChampions` (Phase 0), `homeRecap` (WS10). Snapshot each mode at 390 and 1280px.

#### Alternatives considered

- A 45-day featured window: pins one event for six weeks; the Next LCA line covers later events.
- A single partner event up to 60 days out as the hero card: off-site primary action, reads as endorsement, not "what's on".
- Search as the quiet-mode hero (Home-B): turns the usual homepage into the option K did not pick.
- A "Start here" band under the identity line: duplicates the doors band and the header search, changes the brief's phone order.
- Hiding the doors band in the quiet mode: breaks the brief's lower order.
- A new `registration_opens_at` migration: the column already exists.
- Parsing free-text club schedules for "Tonight": wrong times are worse than none.
- An admin-pinned hero event: an editorial step nobody will maintain, and a route for partner events into LCA prominence.

---

### Q5. Search: header trigger, homepage box, one component, no Players group

#### Where it lives

Both places, one component (`SearchCombobox`) in three containers, one endpoint.
- **Header, every page:** the Q2 trigger. From 768px up it opens a modal panel (`role="dialog"`, `aria-modal`) under the bar; on phones it navigates to `/search`. ⌘K / Ctrl+K toggles the panel from anywhere except an editable field. The trigger is an `<a href="/search">` underneath, so it works without JavaScript.
- **Homepage:** the same combobox inline in the identity and search band, 56px tall (48px on phones), with a visible label "Search tournaments, clubs and news" (not placeholder-only; placeholders vanish on typing) and a gold Search button. Results drop below the field as a listbox capped at 60vh, as an overlay (`position: absolute`, above the this-week strip, z-index under the header) that never pushes the page down; it opens with the Popular list only after the field is clicked or receives keyboard focus from Tab, never on page load. On phones, Enter goes to `/search?q=`.
- **`/search?q=&type=`:** a full page, field focused, every match with no cap, type chips for every group in group order (Tournaments · Clubs · Pages · News · Results · Champions, plus Your tools when signed in, filtered on the client), `q` written with `replaceState` so Back, refresh and sharing work.

#### Result groups, in order (at most 20 rows in the panel, 5 per group)

1. **Tournaments:** upcoming LCA events (status in words, count), then partner listings: Louisiana first, then the rest of the Gulf South with the state shown ("Houston, TX"). Partner rows carry "Partner event · Registers on the organizer's site" with ↗ and a new-tab note; never Register, never a count. Finished LCA events are not here; they are group 5, so no event appears twice.
2. **Clubs:** name, city (Picayune shows "MS"; never a hard-coded ", LA"), region and the free-text meeting line until WS09. Region names and aliases ("NOLA", "Northshore", "Acadiana") match and link to `/clubs?region=`.
3. **Pages:** about 40 static entries from `nav.ts` plus a plain-language synonym table written in parents' words (kids, youth, school, first tournament → Your child's first tournament; rating, USCF, ID → US Chess ID help; bylaws, minutes, board, donate, join, renew, scanner, scoresheet). Pages are matched on the client, so they appear instantly with no request. K reviews the synonym list once. The UI always says "US Chess".
4. **News:** published `lca_posts` titles from the last 24 months, dated with weekday.
5. **Results:** finished LCA events matched by event name, year or city ("Morphy 2026" → "2026 Paul Morphy Open · Final standings · Sat–Sun, Jun 12–13"), linking to that event's standings. Built from `tournaments` and the end date, never from person names, so it works before WS10.
6. **Champions:** `state_champions` rows matched on **title and year only**, and displayed as title and year only: "2026 Louisiana State Champion · Open › `/champions#2026`". The response carries no name field, and the champion column is never matched. The table holds State Scholastic K–12 titles, so name matching would make children's names searchable site-wide; the name lookup already exists on `/champions` itself.
7. **Your tools** (signed in, built on the client from `roles.ts`, page links only): "Workspace · Paul Morphy Open (you direct)", "Admin · Support tickets", "Admin · Members". The server response is identical signed in and out; a role-safety test asserts it.
8. For a query that looks like a person's name (two capitalised words) or an 8-digit US Chess ID: one fixed row "Look up a rating on US Chess ↗ (opens US Chess)". This is what Home-B's own "Players" row actually was. It is not appended to every list.

**Players:** dropped. D9 means no player pages, and a name search that collects one person's results across events, children included, is a player page by another route. No person name is ever in the index or matched. Someone asking "how did I do?" is pointed to My LCA, which WS13 gives for their own results.

**Empty query:** a Popular list: Find a club · Your child's first tournament · Membership · State champions · Bylaws & rules · Minutes · Donate · Scoresheet scanner, every label from `nav.ts`. Once WS07 is live and `/api/live/now` returns an event, "Live now: Paul Morphy Open · Round 3 pairings" is the first row (public pairings link, nothing personal); there is no standing "Pairings & standings" row, because it has no target when nothing is live. No recent searches are stored: on a shared family device they would expose earlier queries.

**No results:** "No matches for 'xyz'. Try a city, a club name or a month." plus links to Tournaments, Clubs and Contact. **Error:** page matches stay and the panel says "Tournaments and clubs couldn't load. Try again."

#### Keyboard and screen readers

- The input is an ARIA 1.2 `combobox` with `aria-expanded`, `aria-controls` and `aria-activedescendant`; the list is a `listbox` with a labelled `group` per heading.
- ↑ / ↓ move across groups and wrap. Home and End move the caret in the field (editable combobox, ARIA APG). Enter opens the active row, or `/search?q=` when none is active. Ctrl / ⌘ + Enter opens in a new tab. Tab leaves the inline box; focus is trapped in the modal.
- Esc in the modal closes it and returns focus to the trigger. In the inline box, the first Esc closes the list and the second clears the text.
- **The "/" shortcut is dropped.** WCAG 2.1.4 (Level A) forbids single-character shortcuts unless they can be turned off or remapped; "ignored while typing" is not one of its exceptions, and "/" collides with screen-reader quick keys. ⌘K / Ctrl+K and the visible button are enough. The brief's WS02 search bullet loses "/".
- The active row shows a 2px navy inset outline plus a tint; H4's `#f3eedc` tint alone is 1.16:1 and fails WCAG 1.4.11. Matched letters are bold and underlined, in navy or `#866a1e`, never brand gold. Under `.dark` the panel uses `--popover` (`#1a2744`), the active row `rgba(255,255,255,.1)` with a 2px ring in `#c8a94a`, and matched letters in `#e8ecf4`.
- A polite status region, debounced to about 400 ms after typing settles, says "7 results" or "No results" (WCAG 4.1.3). Results show from 2 characters, with a 150 ms request debounce and an `AbortController`.

#### Index

Keep the brief's **`GET /api/search?q=`** (public, 2–64 characters; normalisation is lowercase, NFD with diacritics stripped, "&" → "and", "saint" → "st", whitespace collapsed; the edge cache key is `search:v1:${normalised}`), running bounded `LIKE` queries over `tournaments` (visible; upcoming plus completed within 3 years), `clearinghouse` (upcoming, 180 days ahead), `clubs`, `lca_posts` (published, 24 months) and `state_champions` (title and year). A few hundred rows in total, under 1,000 documents, so no FTS5 table and no refresh-on-write to maintain. Edge cache 60 s per normalised query, p95 under 300 ms warm. Static pages never leave the client. The response shape is the `SearchResponse` interface in section 5.5; it contains no member, registration, email or player-name fields (integration test). If logs show typo misses later, add FTS5 then.

#### Why

- The evidence for a visible search box (NN/g, cited on H4) supports a real box where browsing starts, which is the homepage; H4's own trade-off note doubts a full box in every header for a 40-page site. So the header carries a compact, consistent trigger and the homepage carries the box. Both of K's readings hold.
- One component means one keyboard model, one result format and one test suite.
- Keeping the brief's endpoint avoids a recorded deviation and a second ranking engine; two judges kept it, one preferred a client index, and the difference at this size is small.

#### What it replaces in the brief

WS02 search bullet ("/", "Home-B search moved into the header"), WS02 API group list, AC5 (3 characters → 2), WS02 Frontend (`SearchCommand.tsx` becomes the combobox family), §1.2 Home row ("Home-B search via ⌘K"). Exact text in section 5.

#### Build impact

WS02: `src/components/search/SearchCombobox.tsx` (hand-rolled ARIA combobox on the existing Radix dialog; `cmdk` is not installed, and it is adopted only if it passes axe plus VoiceOver and TalkBack in all three containers), `SearchPanel.tsx`, `SearchResults.tsx`, `src/pages/SearchPage.tsx` with the `/search` route, `src/lib/searchPages.ts` (pages, synonyms, aliases), `functions/api/search.ts` extended with regions and champions, an `api.ts` wrapper so the route-audit test stays green. WS03 mounts the inline box in `IdentitySearchBand`. Flags: `siteSearch` (WS02) and `homeSearch` (WS03), so K can try the home placement on its own.

#### Alternatives considered

- H4's Players group or any name-linked list (D9).
- A later "In results" group of adult names: needs age data that rule 0.1.3 forbids collecting, and children play in open sections.
- Matching champion names site-wide: exposes minors' names in search.
- A client-side index as the primary mechanism: a brief deviation and a second ranking engine for a few hundred rows; revisit if latency misses the budget.
- Louisiana-only clearinghouse rows: silently narrows the Gulf South coverage the brief defines.
- The US Chess row on every result list: noise.
- Search as the quiet-mode hero: see Q4.

---

## 3. Event mode: who sees what, when

Example: the Paul Morphy Open, Sat–Sun, Jun 12–13, 2027, New Orleans, 5 rounds. Round 3 posted Sat 6:41 PM, starts 7:00 PM. Round 4 Sun 9:30 AM. Maya and Theo are a guardian's children. The strip is the desktop line; the pill is the phone's docked event bar; the banner is the phone's in-flow card. "Nothing" means no strip, pill or banner. "Players see:" is the echo TDs and admins get on every line. The public column covers signed-out visitors and signed-in members who are not involved.

Phase 0 ships rows 1–4 and 8, plus the TD line of row 9 (the data exists today; the phase predicates are in Q2). Rows 5–7 need WS07's `round_publications`, and so does the admin nudge in row 9. The rest of row 9 is the homepage's job, not the strip's.

| Moment | Registered player | Guardian | TD | Admin | Public |
|---|---|---|---|---|---|
| **Event week** (`week`: 6 days before to 2 days before) | Strip: "This week · Paul Morphy Open · Sat–Sun, Jun 12–13 · You're in the Open section · Bye: Round 4, ½ point · Entry paid" [Event details] · Something wrong? Tell the TD (the support form, prefilled with the event). Unpaid: "Payment not finished · $40" [Finish payment]. Waitlisted: "You're #2 on the waitlist".<br>Phone: no pill; a card at the top of My LCA and on Home. No banner. | Strip: "This week · Paul Morphy Open · Sat–Sun, Jun 12–13 · Maya (K–5) and Theo (K–8) are entered · Entry paid" [Event details].<br>Phone: My LCA card only. | Strip: "This week · Paul Morphy Open · 42 registered · 3 unpaid · 2 waitlisted · Round 1 Sat, Jun 12 at 10:00 AM" [TD console] · Players see: "You're in the Open section · Sat–Sun, Jun 12–13". Fix-it when needed: "Round times missing: players see 'time to be announced'" → Add round times.<br>Phone: My LCA card only. | Strip: the TD line with [TD console].<br>Phone: My LCA card only. | Nothing. Home shows the REGISTER or LAST CALL hero. |
| **Day before** (`dayBefore`, Fri) | Strip: "Tomorrow · Paul Morphy Open · Check in at the desk before Round 1 at 10:00 AM · [venue], New Orleans" [Directions & details].<br>Phone: no pill. No banner. | Strip: "Tomorrow · Paul Morphy Open · Maya and Theo · Check in at the desk before Round 1 at 10:00 AM" [Directions & details].<br>Phone: nothing. | Strip: "Tomorrow · Paul Morphy Open · 42 registered · 1 unpaid · Round 1 at 10:00 AM" [TD console] · Players see: "Tomorrow · Check in at the desk before Round 1 at 10:00 AM".<br>Phone: nothing. | The TD line with [TD console]. | Nothing. |
| **Check-in open** (`checkin`: each event day from 6:00 AM until that day's first `round_schedule` time; after WS07, until Round 1 is posted) | Strip: "Today · Paul Morphy Open · Check in at the desk before Round 1 at 10:00 AM · Not checked in yet" → after check-in, "Checked in 8:52 AM" [Event details].<br>Pill: "Today · Check in before Round 1 at 10:00 AM" / "Not checked in yet ›".<br>Banner, once: "Check-in is open" / "Check in at the TD table. Round 1 starts at 10:00 AM." [Event details] [Dismiss]. | Strip: "Today · Paul Morphy Open · Maya: checked in 8:52 AM · Theo: not checked in yet" [Event details].<br>Pill: "Today · Check in before Round 1 at 10:00 AM" / "Theo: not checked in yet ›".<br>Banner, once: "Check-in is open" / one sentence per child. | Strip: "Check-in · 31 of 42 checked in · Round 1 at 10:00 AM" [Open check-in] (deep-links to the console's check-in step; reads "TD console" until WS08 adds that step) · Players see: "Check in at the desk before Round 1 at 10:00 AM".<br>Pill: "Check-in · 31 of 42 checked in ›".<br>Banner: none. | Strip: "Check-in · 31 of 42 checked in · Round 1 at 10:00 AM" [Open check-in] · Players see: ….<br>Pill: "Check-in · 31 of 42 checked in ›".<br>Banner: none. | Nothing. Home shows the EVENT DAY hero (Phase 0) or LIVE (WS07). |
| **Event day, Phase 0 only** (`eventDay`: after the day's first round time until 11:59 PM; never produced once WS07 ships) | Strip (light tint): "Today · Paul Morphy Open · Round 2 at 2:30 PM" [Event details] · Pairings. "Rounds are under way" when no round time remains today.<br>Pill: "Today · Paul Morphy Open" / "Round 2 at 2:30 PM ›".<br>Banner: none. | Strip: "Today · Paul Morphy Open · Maya and Theo · Round 2 at 2:30 PM" [Event details] · Pairings.<br>Pill: "Today · Paul Morphy Open" / "Round 2 at 2:30 PM ›".<br>Banner: none. | Strip: "Today · Paul Morphy Open · 42 checked in · Round 2 at 2:30 PM" [TD console] · Players see: "Today · Round 2 at 2:30 PM".<br>Pill: "Today · Round 2 at 2:30 PM ›".<br>Banner: none. | The TD line with [TD console].<br>Pill: "Today · Round 2 at 2:30 PM ›". | Nothing. Home shows the EVENT DAY hero. |
| **Round N pairings posted** (`roundPosted`, WS07) | Strip (live tokens, sticky): "Live · Round 3 of 5 · Board 6 · White vs Priya Shah · starts 7:00 PM · Updated 6:41 PM" [My board] Pairings · Standings. Bye: "Round 3: ½-point bye". Not yet paired: "Round 3 pairings aren't posted yet for U1400".<br>Pill: "Round 3 · Board 6 · White" / "vs Priya Shah · starts 7:00 PM ›".<br>Banner: "Round 3 pairings are posted · 6:41 PM" / "You're on board 6 with White against Priya Shah. Round 3 starts at 7:00 PM." [Open my board] [Dismiss]. | Strip: "Live · Round 3 of 5 · Maya plays White on board 6 · Theo plays Black on board 14 · starts 7:00 PM" [My players]. Three or more: "3 of your players are paired" [See boards].<br>Pill: "Round 3 · Maya: board 6 · Theo: board 14" / "starts 7:00 PM ›".<br>Banner: "Round 3 pairings are posted · 6:41 PM" / one sentence per child, plus "New to tournament days? What to expect" the first time. | Strip: "Live · Round 3 posted 6:41 PM · 0 of 30 results in" [Enter results] · Players see: "Round 3 pairings posted 6:41 PM · starts 7:00 PM".<br>Pill: "Round 3 · 0 of 30 results in" / "Posted 6:41 PM ›".<br>Banner: "Round 3 pairings are posted · 30 boards · 0 of 30 results in" [Enter results] [Dismiss]. | Strip: "Live · Round 3 posted 6:41 PM · 0 of 30 results in" [TD console] · Players see: ….<br>Pill: "Round 3 · 0 of 30 results in" / "Players see: posted 6:41 PM ›".<br>Banner: "Round 3 pairings are posted · 30 boards" [Open TD console] [Check what players see] [Dismiss]. | Strip: nothing. The Tournaments nav item shows a text tag "Live". On the event's pairings and standings pages, signed out, above Find your name: "Playing today, or is your child? Find your name in the pairings below, or log in to see the board." Home shows the LIVE hero. |
| **Round in progress** (`roundInProgress`, WS07) | Strip: "Live · Round 3 in progress · Board 6, White · Updated 7:04 PM" [My board] Pairings · Standings.<br>Pill: "Round 3 in progress" / "Board 6 · White ›".<br>Banner: none (no new state). | Strip: "Live · Round 3 in progress · Maya: board 6 · Theo: board 14" [My players].<br>Pill: "Round 3 in progress" / "Maya: board 6 · Theo: board 14 ›".<br>Banner: none. | Strip: "Live · Round 3 · 14 of 30 results in · missing boards 2, 9, 14" [Enter results] · Players see: "Round 3 in progress".<br>Pill: "Round 3 · 14 of 30 results in ›".<br>Banner: none. | The TD line with [TD console].<br>Pill: "Round 3 · 14 of 30 results in ›". | Strip: nothing. "Live" tag on Tournaments. |
| **Between rounds** (`between`, WS07: results in, next round not posted) | Strip (live tokens): "Round 3: Won · Your score 2½ · Round 4 Sun at 9:30 AM, not paired yet" [Standings].<br>Pill: "Round 3: Won · 2½ so far" / "Round 4 Sun at 9:30 AM ›".<br>Banner: none. | Strip: "Round 3: Maya won · Theo drew (½) · Round 4 Sun at 9:30 AM" [Standings].<br>Pill: "Round 3 done" / "Round 4 Sun at 9:30 AM ›". | Strip: "All Round 3 results are in · Round 4 set for Sun 9:30 AM" [Pair Round 4] · Players see: "Round 4 Sun at 9:30 AM, not paired yet".<br>Pill: "All Round 3 results in" / "Pair Round 4 ›".<br>Banner, once: "All Round 3 results are in" / "Pair Round 4 when you're ready. It's set for Sun 9:30 AM." [Open TD console] [Dismiss]. | The TD line with [TD console] and the TD banner with [Open TD console]. | Strip: nothing. The "Live" tag shows while `live_state = 'live'` and the next round in `round_schedule` starts today (America/Chicago); it is off from the last published round's results-complete time until the next round's day. The same predicate drives `/api/live/now` and the LIVE hero. |
| **Final standings posted** (`final`: `status = 'completed'`, or a non-null result in every section's last scheduled round; then `after` until `eventEnd` + 48 h) | Strip (light tint): "Final standings posted · You finished 4th in Open with 3½ of 5" [Final standings].<br>Pill: "Final · 3½ of 5 · 4th in Open" / "Final standings ›".<br>Banner, once: "Final standings are posted" / "You finished 4th in the Open section with 3½ of 5." [Final standings] [Dismiss]. | Strip: "Final standings posted · Maya: 3 of 5 · Theo: 2½ of 5" [Final standings].<br>Pill: "Final" / "Maya 3 · Theo 2½ ›".<br>Banner, once: one sentence per child. | Strip: "Final standings posted · Send the rating report" [Rating report] · Players see: "Final standings posted". Shows while the event is not yet marked completed, through `after`.<br>Pill: "Final standings posted" / "Send the rating report ›".<br>Banner, once: "Final standings are posted · 30 boards" [Open TD console]. | The TD line with [TD console]. | Nothing in the header. Home shows the RESULTS hero. |
| **Week after** (48 h to 7 days after `eventEnd`) | Nothing. Home shows the RESULTS hero with "You finished 4th with 3½" added on the client. | Nothing. | Strip only if the event is not yet marked completed: "Paul Morphy Open · Send the rating report" [Rating report].<br>Phone: no bar, no banner; the line appears in My LCA. | Nothing in Phase 0. WS07 (`live_state = 'finished'`, behind `eventStripLive`): from `eventEnd` + 3 days until completion, "Paul Morphy Open · not marked completed" [TD console].<br>Phone: no bar, no banner; the line appears in My LCA. | Nothing. Home shows the RESULTS hero. |

Notes on the table
- Multi-role: a TD who is also a parent sees the TD line; "+1 more" in My LCA opens the guardian view.
- Hide: any role can hide the strip or pill until the state key changes; TD and admin lines come back on the next state like everyone else's.
- Observers and officers: nothing by default (section 6).
- Check-in copy switches to "Check-in 8:30–9:30 AM" once a check-in window field exists.
- Every line is produced by `eventModeCopy.ts`, so the desktop strip, phone pill, phone banner and "Players see:" echo can never drift apart. Button labels come from the same builder: "TD console" (strip and bar), "Open TD console" (banners), "Open check-in" (check-in step only). No "R3" or "Bd 6" shorthand anywhere, and the admin pill uses the TD's full words ("31 of 42 checked in", "14 of 30 results in").

---

## 4. Homepage hero ladder

First match wins, evaluated on the server in America/Chicago time. "LCA" rows are visible `tournaments` rows with no `registration_url`. Partner rows are Louisiana `clearinghouse` rows with a sync under 3 days old.

| # | Mode | Trigger | Primary action | Secondary | At 390px | Data from | Flag |
|---|---|---|---|---|---|---|---|
| 1 | **Live** | An LCA event has a published round (`round_publications`) and is not finished | Find my board | Pairings · Standings · Event page; Pause updates | Dark card about 330px tall: "Live · Round 3 of 5" tag, event name at 26px, the plain sentence, "posted 6:41 PM · starts 7:00 PM", full-width Find your name field, 48px gold button, two text links, round row as "1 Final · 2 Final · 3 Live · 4 · 5" under a visible "Rounds" heading with every word in the DOM; live colour tokens only, no live fonts | WS07 | `homeLive` |
| 2 | **Event day** | Today is between an LCA event's `date` and `eventEnd` (`end_date` NULL means one day), and rung 1 is off or unmatched | Event details | Pairings | 96px photo strip, "Today · Louisiana State Championship", "Sulphur · Round 1 at 10:00 AM", full-width button | Phase 0 (`tournaments`, `round_schedule`) | `newHome` |
| 3 | **Register, last call** | An LCA event that is `isOpen` or `isClosedOnline` starts within 14 days, or its `early_deadline` is within 7 days | By registration state: Register · from $30 (`isOpen`); Join the waitlist (`isFull`); Event details (`isClosedOnline`); Your entry when already in | Event details · Add to calendar | Home-Phones A: 96px photo strip, tags "Registration open" and "LCA event", title 26px, dates and city, format in plain words, sections and "$30–$60", "38 of 60 registered · 22 spots left" with a 6px bar, two 44px buttons; "early entry ends Tue, Jun 1" as one extra line | Phase 0 (`tournaments`, `registrations` count, `pricing.ts`, `max_players`, `early_deadline`) | `newHome` |
| 4 | **Results** | An LCA event with `eventEnd` within 7 days, `status = 'completed'`, and a non-null result in every section's last scheduled round (WS10's `event_results` once it exists) | Final standings | Crosstable · LCA on Facebook ↗ · Recap and Photos (WS10, when a recap post is linked) | Heritage accent rule, "Final standings · event · Sat–Mon, Sep 5–7 · Sulphur", winners as a short list ("Open: Marcus Landry, 4½ of 5"), "State champion" label, full-width button; no photo | Phase 0 (`computeStandings`, `tournamentPrizes`, `is_state_championship`) | `homeResults` |
| 5 | **Register** | An LCA event that is `isOpen` or `isClosedOnline` starts within 30 days, or its `early_deadline` is within 14 days | Register · from $30 (same variants as rung 3) | Event details · Add to calendar | As rung 3, with the eyebrow "Registration open" instead of "Starts Saturday · in 4 days" | Phase 0 | `newHome` |
| 6 | **Announced** | An LCA event that is `isAnnounced`, starting within 60 days | Signed in: Email me when registration opens. Signed out: Event details | Event details; signed out: Add to my calendar (client-side `.ics`, collects nothing) | Date tile at the left, "Registration opens Fri, Jan 15" (or "Registration not open yet"), full-width button | Phase 0 (`registration_opens_at`, `is_visible`, `tournament_reminders`, `remind.ts`) | `newHome` |
| 7 | **Week** | Club schedules exist | Find a club tonight | This weekend's tournaments (LCA and Partner tags) | "This week in Louisiana chess" heading, Tonight panel first (time, club, place), "19 club meetings at 15 clubs", weekend rows; grid motif | WS09 (`club_schedules`) | `homeWeek` |
| 8 | **This week in Louisiana** | Louisiana events (LCA or partner) start within 14 days; partner rows only while the sync is fresh, LCA rows always | All tournaments | "Or play this week at one of 25+ clubs →"; Next LCA event line | Heading "This weekend in Louisiana" (≤ 7 days) or "Coming up in Louisiana"; up to 3 stacked rows with date tile, name, city, organizer, format, tag, "Organizer's site ↗ (opens in new tab)" on partner rows; grid motif | Phase 0 (`functions/utils/events.ts` over `tournaments` + `clearinghouse`) | `newHome` |
| 9 | **Quiet** | Nothing within 14 days (partner rows only while the sync is fresh) | Find a club near you | Next LCA event card (≤ 180 days); the 3 soonest Louisiana events at any distance ("Sat, Oct 31 · in 23 days", tagged); All tournaments | h1 "Find your next game in Louisiana" at 26px, the Next LCA card, three compact rows, a region select from `clubs.region`, full-width button; grid motif | Phase 0 (`tournaments`, `clearinghouse`, `clubs.region`) | `newHome` |
| 10 | **Clubs** (floor) | Nothing above matches (including a stale or empty feed with no LCA rows in range), or `/api/home` failed on the client | Find a club | Seven region chips | "25+ clubs meet across Louisiana", region chips that wrap, full-width button; grid motif. Never blank | Phase 0 (`clubs`, `regions.ts`) | `newHome` |

Rules that apply to every rung
- Every non-LCA rung ends with "Next LCA event: … ›" when one is announced within 180 days; the line is omitted when there is none.
- Rungs 3, 5 and 6 show "Also this weekend: The Baton Rouge Classic · Partner event · Registers on the organizer's site ↗" at the foot when a Louisiana partner event starts within 7 days; the link goes to the organizer's site until WS04 ships the internal partner page (`/tournaments/p/:slug`), then a "Details" link points there.
- Partner rows never carry Register or a count, and never the LCA hall photo.
- The identity and search band sits under every rung. Then the brief's order: this-week strip (WS09), upcoming six, doors, results and champions, news and Facebook, membership.
- Personal lines are added on the client, never in the shared `/api/home` response: "You're entered" and "You finished 4th" from `/api/me`, "Board 6 · White" and a guardian's children's boards from `useEventMode()` (`/api/me/event-mode`).
- `/api/home` edge cache: 60 s, 15 s in rungs 1 and 2. Every block is `null` when its source is unbuilt, and the client renders nothing for it. While `/api/home` loads, the hero reserves 360px at 390px and 440px at 1280px with a neutral skeleton; if it fails, the client renders rung 10 from the static `regions.ts` with no error chrome.

---

## 5. Spec amendments

Replacement text for `REDESIGN_SPEC.md`, written as the brief writes it, ready to paste. Only the rows and subsections listed change. Record each as a decision in `REDESIGN_STATUS.md` when the matching PR lands.

### 5.1 Section 1.1, the look: replace the Scholastic and Heritage rows, and add a note to the Event-day row

| Scope | Look | How it's applied |
|---|---|---|
| Event-day surfaces | **Broadcast Night** (`Looks-7-*`) | Scoped dark theme via `data-theme="live"` on pairings, standings, My board, hall TV and the event page while a round is live, plus a "Night" toggle, the homepage hero's live mode (colour tokens only, no live fonts on `/`), and the header event strip's colour tokens while a round is live (Geist stays; Barlow loads only on the live routes). Never the site default. The live tag's dot is static; the word "Live" carries the meaning. |
| Scholastic pages | **Bright Scholastic** (`Looks-6-*`) | Scoped via `data-theme="scholastic"` on `/scholastic/*` only, never on registration, checkout, shared event pages, pairings or standings (those show a grade-band chip with its words, "K–5"). Navy carries all text and buttons. Colour only ever means a grade-band section, always beside the band's words; status tags use the base status tokens. WS01 ships the token block and an axe fixture; the Baloo 2 and Nunito chunk and the rollout ship in WS11 behind `themeScholastic`, after K previews it. |
| Heritage pages | **Heritage Club** (`Looks-1-*`) as a scope | **Rule: Minimal is for doing, Heritage is for the lasting record, Broadcast is for what is live now.** Full scope (`data-theme="heritage"` on `<main>`, heritage fonts load) on `/about` (with the history timeline), `/governance/board`, `/governance/bylaws` and `/governance/minutes` (the editors and forms inside them reset to base through `ThemeScope scope="base"`, the one permitted nesting), `/meeting` and `/champions`; later on the membership card, certificates and the final-report cover; and as a component scope for the `HonorBoard` above final standings of events with `is_state_championship = 1` and status completed. Accent only (base scope, Geist, no heritage fonts) on the homepage identity band, Champions band and Results-mode winners block, using `ThickThinRule` and `Seal`. Heritage changes headings, body type, rules, seal, grounds and gold-ink only; it never restyles `Button`, `Input`, chips, nav, `StatusBadge`, the focus ring, control radius, or date and score formats. The header and footer are always base. Everything else, including `/membership`, `/donate`, every form, the print kit and all email, stays Minimal. |

### 5.2 Section 1.2, the pick for each section: replace the Header, Mobile nav, Footer and Home rows

| Section | Build from | Borrow |
|---|---|---|
| Header | `Nav-Header` H1 Refined, one 68px row, condensing to 56px with the rook mark on scroll | H4's search as a field-shaped "Search" button (the word visible at every desktop width, ⌘K / Ctrl K from 1280px) opening the search panel; the full box lives on the homepage. H5's event strip, personalised to involved people (registered players, guardians, the event's TDs, LCA admins) with H2's "same line, other moments" lifecycle; light gold tint before and after the event, the live tokens while a round is live. No public bar; the public gets a worded "Live" tag on Tournaments. "LCA on Facebook ↗" in the About menu's footer row. |
| Mobile nav | `Nav-Mobile` M2 bottom tab bar under 768px: Tournaments · Clubs · Log in / My LCA (to-do count) · Menu | M1's sheet behind the Menu tab, ending with Donate · Log in · Join LCA in the desktop order. M4's pill as a 56px event bar docked above the tab bar inside one `BottomDock`, and M4's banner as an in-flow `role="status"` card. 768–1023px keeps the hybrid header (with a Donate text link) and no tab bar. |
| Footer | `Nav-Footer` F1, the board's four columns minus links to pages that do not exist (section 5.5) | F3's trust line and the Appearance control in the base line; columns fold to tap-to-open groups under 768px |
| Home | `Home-A` next-event hero with a ten-rung ladder (live, event day, last call, results, register, announced, week, this week in Louisiana, quiet, clubs), personalised on the client for involved people | `Home-C` this-week strip, `Home-E` doors band, `Home-D` champions band and recap card, `Home-B` search box in the identity and search band directly under the hero in every mode (and the header trigger everywhere else) |

### 5.3 Section 2.2, shared platform pieces: replace the theme-scope row and add two rows

| Piece | Built in | Used by |
|---|---|---|
| Theme scopes (`data-theme` = base / `heritage` / `live` / `scholastic`, plus `.dark`) and token layer; scope token blocks in `index.css`, only `@font-face` chunks lazy | WS01 | All |
| Per-user involvement endpoint `GET /api/me/event-mode` (private, no-store, ETag) with `functions/utils/eventMode.ts` (pure phase machine) and `src/lib/eventModeCopy.ts` (one copy builder) | WS02 | WS02 strip, dock and banner; WS03 hero personalisation; WS07 (round phases via `round_publications`); WS13 event-day view |
| Unified event query `functions/utils/events.ts` over `tournaments` + `clearinghouse` (moved out of `functions/api/clearinghouse.ts`) | WS03 | WS03 `/api/home`, WS04 `/api/events`, WS11, WS13 |

The existing row "Unified event listing `GET /api/events`" stays with WS04 and now reads "built on `functions/utils/events.ts` from WS03".

### 5.4 WS01: changed subsections

**User-facing scope (replace the Typography bullet and the scholastic sentence; everything else stands)**
- **Typography**:
  - Geist for UI.
  - Geist Mono for chess data in every scope, with tabular figures and ligatures off. It is the only mono face on the site.
  - Instrument Serif as a single display accent in the base look. It never appears inside a heritage scope.
  - Live scope adds Barlow Condensed and Barlow; JetBrains Mono only if the Looks-7 tile requires it.
  - Heritage scope adds Libre Caslon Display 400 (h1 and h2 at 32px and up, and display numerals; never ratings, scores or tables) and Source Serif 4 variable (body at 18px / 1.6 in the readers with a 70ch measure, true small-caps labels with `font-variant-caps: all-small-caps` on labels of 15px or more, lining and tabular figures). The italic face is declared but fetched only when used. Budget ≤ 110 KB woff2, latin subset. A Georgia fallback with `size-adjust` and `ascent-override` keeps CLS under 0.1. If the Fontsource subset lacks `smcp` / `c2sc`, use uppercase at 0.85em with .06–.08em tracking, never synthesised small caps.
  - Scholastic scope adds Baloo 2 and Nunito in WS11, not here.
  - Scope fonts load only inside their scope, through a lazily imported CSS module. All scope token blocks live in `src/index.css`, so a scope switch never flashes base colours.
- **Heritage tokens** (`[data-theme="heritage"]`): paper `#f7f3e8`, card `#fffdf8`, inset `#ece4d0`, ink `#1a2744`, muted `#5e5a52`, hairline `#d8cdb4` (decorative only), field border `#857d6b`, gold-ink `#705718` (`--gold-ink` resolves to this inside the scope and to `#866a1e` in base), baize `#2d5a45`, claret `#8a2b38`. Brand gold is rules, seals and text on navy only (2.05:1 on paper). The 2px radius applies to cards, tables and hero mats; controls keep the base radius. Under `.dark`, heritage keeps type, rules and seal on the Minimal dark grounds. Scopes nest one level only, base-inside-heritage being the one permitted nesting (`ThemeScope scope="base"` around editors and forms); heritage never renders inside live.
- **Motion:** the live tag's dot is static. Nothing pulses.

**Frontend (add)**
- New: `src/styles/themes/heritage.css`, `live.css` (font imports only), `src/layouts/HeritageLayout.tsx` (lazy layout route wrapping `AboutPage`, `BoardPage`, `BylawsPage`, `MinutesPage`, `AnnualMeetingPage` and `ChampionsPage`, with `GovLayout` kept inside), `src/components/ThickThinRule.tsx`, `src/components/Seal.tsx` (SVG built from `LcaMark`), a `.small-caps` utility. `ThemeScope.tsx` accepts `heritage` and `base` (a `data-theme=""` reset, used by `GovernanceDocuments` around its form and `RichTextEditor`).
- The gold-text guard becomes scope-aware: `#c8a94a` is never text on `#f7f3e8` or any light ground, including the phone tab bar; `#705718` is allowed inside heritage and as the About menu's "You are here" label; `#866a1e` is allowed as text at 13px or more on `#fbfaf6` and as the tab bar's current-tab bar. The allowlist is a test fixture.

**Jobs & integrations (replace)**
Fontsource packages: `@fontsource-variable/geist-mono`, `@fontsource/instrument-serif`, `@fontsource/barlow-condensed`, `@fontsource/barlow`, `@fontsource/libre-caslon-display`, `@fontsource-variable/source-serif-4`. Verify each package name on npm, and verify the latin subset keeps `smcp` / `c2sc`. `@fontsource-variable/baloo-2` and `@fontsource-variable/nunito` move to WS11. Also Playwright with axe.

**Acceptance criteria (replace 1 and add 11–14)**
1. axe reports zero serious or critical violations on `/`, `/tournaments`, a tournament detail page, `/clubs`, `/membership`, `/scholastic`, `/about`, `/governance/minutes` and `/champions` in the light, dark, live and heritage scopes, plus the scholastic token fixture page.
11. The heritage font chunk never appears in the `/` network log. CLS on `/about` and `/governance/bylaws` stays under 0.1 across the font swap.
12. A unit test over the route-to-scope map fails if any workspace or admin route resolves to heritage, and a render test mounts `RichTextEditor` and the `GovernanceDocuments` form inside `HeritageLayout` and asserts that the closest `data-theme` above each is `""` (their `ThemeScope scope="base"` boundary), never `heritage`. No Instrument Serif renders inside `[data-theme="heritage"]`, and Caslon is bound only to the `--font-display` token used by h1 and h2 inside the scope.
13. Inside the heritage scope, `Button`, `Input`, `StatusBadge` and the focus ring render pixel-identical to base (visual test).
14. The live tag's dot does not animate.

**Tests (replace)**
- Unit `test/unit/themeScopes.test.ts`: the route-to-scope map (no workspace or admin route is heritage); `--gold-ink` resolves to `#705718` inside heritage and `#866a1e` in base.
- Unit `test/unit/governanceEditors.test.tsx`: `RichTextEditor` and the `GovernanceDocuments` form rendered inside `HeritageLayout` have no heritage ancestor inside their base boundary.
- Unit `test/unit/goldText.test.ts`: the scope-aware gold guard with its allowlist fixture (`#705718` in heritage and the "You are here" label, `#866a1e` at 13px+ on `#fbfaf6` and the tab bar's current-tab bar; `#c8a94a` never text on a light ground).
- a11y `test/a11y/scopes.spec.ts` (Playwright + axe): AC1's pages in light, dark, live and heritage plus the scholastic fixture; CLS under 0.1 on `/about` and `/governance/bylaws` across the font swap; the heritage chunk absent from the `/` network log; the live tag's dot static; `Button`, `Input`, `StatusBadge` and the focus ring pixel-identical inside heritage (visual test).

**Depends on:** nothing. This goes first.

### 5.5 WS02: changed subsections

**User-facing scope (replace the Desktop, Between md and lg, Mobile, Event mode, Search and Footer bullets; Routes stand)**
- **Desktop (≥ 1024 px):** one navy row, 68px at rest, sticky; after 80px of scroll it condenses to 56px and the rook mark replaces the logo (D1). The official logo sits on a 44px cream plate beside "Louisiana Chess Association" (text hidden from 1024 to 1279px); the brand link is always `aria-label="Louisiana Chess Association, home"` and its image is `aria-hidden`. Then **Tournaments · Clubs · Scholastic · News · Membership · About ▾**. "About" opens on click, with a caret. Its items: About LCA, Board & regions, Bylaws & rules, Minutes, Annual meeting, Champions, Contact (the current row: `#f3eedc` tint, title navy 600, "You are here" at 13px/600 in `#705718`); footer row "LCA on Facebook ↗". One label per destination from `nav.ts`: "Board & regions", "Bylaws & rules" and "Minutes" read the same in the header, sheet, footer, trust line and search. A field-shaped **Search** button sits left of the utilities (icon plus the visible word at 1024–1279px; 220px with a ⌘K / Ctrl K hint from 1280px; an `<a href="/search">` underneath). Top right, in this order on every page: **Donate · Log in** (or **My LCA ▾** when signed in) **· Join LCA** (gold). Members don't see "Join LCA"; they see "Renew" within 30 days of expiry or once lapsed. The My LCA trigger carries the to-do count from `src/lib/todo.ts` (accessible name "My LCA, 2 things to do"); the menu holds the to-do items first, then My LCA, the active event line while event mode is on, Family, then Workspace / Admin / Board inbox / My region's clubs by role, then Log out. The current section is marked with `aria-current="page"` plus a visible underline. A `--header-h` variable from a `ResizeObserver` over every sticky element in the top stack (`AnnouncementBanner` when sticky, the header, the strip in round states) feeds `scroll-padding-top`; z-order top to bottom is the search panel and menus, the header, the strip, `AnnouncementBanner`. A "Skip to content" link is the first focusable element on every page. Log in links at every width pass `state={{ from }}` to `/login`, which is what `LoginPage.tsx` reads.
- **Tablet (768–1023 px):** the same header component: rook mark, Tournaments and Clubs visible, Search, a Donate text link, Log in or My LCA ▾ (with the to-do count), and a bordered "Menu" button opening the mobile sheet as a right drawer. No tab bar. The event strip renders as one 48px line: status tag · event name · the viewer's sentence (truncated, full text in `title` and in My LCA) · primary button · the 44×44 Hide button; secondary links and the "Players see:" echo move into My LCA ▾.
- **Phones (< 768 px):** a 56px navy app bar (rook mark and the two-line name; a 44×44 "Search" button to `/search`; the current section name when the Menu tab is current) and a bottom tab bar in `<nav aria-label="Main">`, 56px plus `env(safe-area-inset-bottom)`: **Tournaments · Clubs · Log in / My LCA (to-do count) · Menu**. Labels come from `nav.ts` and always show; the current tab is bold navy with a 3px top bar in gold-ink `#866a1e` and `aria-current="page"`. Menu opens the full-height sheet (sections with the current one expanded as "You are here"; Scoresheet scanner under Tournaments, with "This weekend" and "Results" added only when WS04 and WS10 ship their routes; Donate · Log in · Join LCA in the desktop order; role tools; Facebook · Contact · Website help; the theme switch, a shortcut to the footer's; "Hide event bar until the next update" while event mode is on, writing the same `event:phase:round` key as the bar's Hide button). One `BottomDock` holds the page action bar, the event bar and the tabs, writes `--bottom-chrome-h` from a `ResizeObserver`, and drives `<main>` padding-bottom and `scroll-padding-bottom`. The dock hides while the on-screen keyboard is open, on routes that declare `hideTabBar` (registration, checkout, success, the Stripe hand-off, scanner capture, TV, print), and under 480px of height or at high zoom, where the app bar shows the bordered Menu button instead. The to-do count is computed on the client from `/api/me` (unpaid entries for self or children for events not yet ended; an `active` membership expiring within 30 days or an `expired` one, never `pending`; a US Chess membership ending before an entered event), fetched on load and focus, never polled; volunteer queues and event-day items never count. DOM order: app bar, "Skip to content" link, `<main>`, `BottomDock`, then the portalled sheet. `index.html` gains `viewport-fit=cover`. There is no separate phone flag: `newNav` ships the app bar, tab bar and sheet with the header.
- **Event mode:** a personal strip for LCA-run events only, shown to a signed-in registered player (including waitlisted), the guardian of a registered dependent, the event's TDs and `lca_admin`, from 6 days before day 1 until `eventEnd` + 48 hours, where `eventEnd = (end_date ?? date) 23:59` Central. Phases (`functions/utils/eventMode.ts`): `week`, `dayBefore`, `checkin` (6:00 AM until the day's first `round_schedule` time), `eventDay` (Phase 0 only, the rest of the day: "Today · event · Round 2 at 2:30 PM"), `roundPosted` / `roundInProgress` / `between` (WS07), `final` (`status = 'completed'`, or a non-null result in every section's last scheduled round) and `after` (48 hours; the TD's rating-report line until completed; the admin "not marked completed" nudge is WS07). Light gold tint `#fbf7e9` before the event, during check-in and after the final (scrolls away); `data-theme="live"` tokens with a 2px gold top rule while a round is posted, in progress or between rounds (sticky, Geist type). One line per person: status tag in words · event name · the viewer's own sentence · primary button · secondary links · a 44×44 "Hide until the next update" button. Absolute times, no countdown. TD and admin lines end with "Players see: <the public line>" and may carry one fix-it ("Round times missing: players see 'time to be announced'" → Add round times). Precedence TD > admin > player > guardian; exactly one strip, and with two events the one whose next moment is sooner; the rest in My LCA ▾. Hidden state is keyed `event:phase:round` in `localStorage` inside try/catch, with one label ("Hide until the next update") and one key for the strip, the phone bar and the sheet item, and the event stays listed in My LCA ▾. On a failed poll the strip keeps its last payload and "Updated" time, retries with backoff and hides only after three consecutive failures in a round phase; it never shows an error. A persistent visually hidden `role="status"` node announces state changes only. Buttons: "TD console" on the strip and bar for TDs and admins alike, "Open TD console" on banners, "Open check-in" only when the console deep-links to its check-in step; no "R3"-style shorthand anywhere. On phones the same data renders, from check-in on day 1, as a 56px two-line event bar docked above the tab bar (hidden on that event's own pairings and standings pages) and an in-flow `role="status"` banner inserted only on page load or at the top of the page; otherwise the bar shows a "New" tag and the dock's status node speaks (it stays silent when a banner is inserted). "Something wrong? Tell the TD" opens the support form prefilled with the event and the person's name and email, tagged with the tournament id; no personal email is shown. The public sees no strip: while `/api/live/now` returns an LCA event, the Tournaments nav item carries a text tag "Live" and (WS07, `eventStripLive`) the event's own pairings and standings pages show "Playing today, or is your child? Find your name in the pairings below, or log in to see the board." above the Find-your-name field, for LCA-run events only. It never appears for partner events or on checkout pages. The round-alert bell is hidden until WS07's email alerts exist.
- **Search:** ⌘K / Ctrl+K and the header Search button open a search panel over tournaments (LCA and partner), clubs and regions, pages, news, results (finished LCA events) and champions (title and year only), with a role-gated "Your tools" group for signed-in volunteers and a "Look up a rating on US Chess ↗" row for name-like or ID-like queries. There is no Players group and no person name is ever matched (D9). The "/" shortcut is not bound (WCAG 2.1.4). On phones the button goes to `/search?q=`. The same combobox renders inline on the homepage (WS03). `/search?q=&type=` offers a chip per group in group order (Champions included; Your tools when signed in).
- **Footer (F1, replace the brief's column list):** four columns, every link a `nav.ts` entry by id: Play (Tournaments, Scholastic chess, State champions, Scoresheet scanner; Calendar and Results join when WS04 and WS10 ship their routes) · Community (Clubs, Club map (`/clubs`, the map section), List or update your club (the contact form with the club subject preselected), News, LCA on Facebook ↗) · About LCA (About LCA, Board & regions, Bylaws & rules, Minutes, Annual meeting) · Contact (Contact form, Membership help, Website help, Donate). The brand block keeps the official logo, Join LCA and Donate. The base line holds the F3 trust line ("US Chess state affiliate · Louisiana's chess community since 1915 · Bylaws & rules · Minutes · Site last updated <build date>") and the Appearance control ("Appearance: System · Light · Dark", a three-button radio group stored in `localStorage` inside try/catch, default System, the one theme switch that exists at every width). No Privacy or Accessibility links until those static pages exist. Under 768px each column heading becomes `<h2><button aria-expanded aria-controls>` toggling its list; all collapsed by default except Contact; the brand block and base line are always visible; no animation under reduced motion.
- **Under `.dark`** (every value is a WS01 token; nothing is invented in WS02):

| Surface | Light | Dark |
|---|---|---|
| Header, app bar | `#1a2744` | `#1a2744` |
| Tab bar, event bar | white, 1px `#d9d8d1` top border, labels navy, current-tab bar `#866a1e` | `#111a2c`, `rgba(255,255,255,.08)` top border, labels `#9aa6bf`, current `#e8ecf4` with a 3px `#c8a94a` bar |
| Event strip, pre and post states | `#fbf7e9`, navy text, 1px `#866a1e` rule | `#1a2744`, `#e8ecf4` text, 1px `#c8a94a` rule |
| Event strip, round states | live tokens (`#0e1526` / `#f3f5f9`) | unchanged |
| Banner card | white card, border token | `#111a2c`, border token |
| About and My LCA menus, Menu sheet, search panel | `--popover` white, current row `#f3eedc` | `--popover #1a2744`, `#e8ecf4` text, current and active rows `rgba(255,255,255,.1)` plus a 2px `#c8a94a` ring on the active search row |

**API (replace).** Contracts live in `functions/utils/apiTypes.ts` and are imported by both the Worker and `src/lib/api.ts`.
- `GET /api/search?q=` (new, public): `q` of 2–64 characters, normalised (lowercase, NFD with diacritics stripped, "&" → "and", "saint" → "st", whitespace collapsed); bounded `LIKE` queries over `tournaments` (visible; upcoming for the Tournaments group, completed within 3 years for the Results group, never both), `clearinghouse` (upcoming, Louisiana first, then Gulf South with the state), `clubs` (with regions from `regions.ts`), `lca_posts` (published, 24 months) and `state_champions` (title and year, displayed as title and year). Static pages are matched on the client. At most 20 results, 5 per group, edge cache 60 s under the key `search:v1:${normalised}`. The response is identical signed in and out and contains no member, registration, email or player-name fields.

```ts
interface SearchResponse {
  q: string
  groups: Array<{
    type: 'tournaments' | 'clubs' | 'news' | 'results' | 'champions'
    label: string
    items: Array<{
      id: string; title: string; meta?: string; href: string
      tag?: { label: string; tone: 'open' | 'soon' | 'closed' | 'partner' | 'lca' | 'final' }
      external?: boolean
    }>
  }>
}
```

- `GET /api/me/event-mode` (new; `requireAuthedMember`; `Cache-Control: private, no-store`; ETag with 304). Computed by `functions/utils/eventMode.ts` from `registrations`, `members.guardian_id`, `tournament_directors`, `tournaments` and, after WS07, `round_publications` and `live_state`. The client calls it only when `/api/me` shows an involvement inside a window; polls every `pollSeconds` while visible, never while hidden. Or 204.

```ts
type EventPhase =
  | 'week' | 'dayBefore' | 'checkin' | 'eventDay'
  | 'roundPosted' | 'roundInProgress' | 'between' | 'final' | 'after'

interface EventModePlayer {
  memberId: string; firstName: string; section: string; paid: boolean
  waitlistPosition?: number
  bye?: { round: number; points: '½' | '1' | '0' }
  checkedInAt?: string
  board?: number; color?: 'white' | 'black'; opponent?: string; opponentRating?: number
  result?: 'won' | 'lost' | 'draw'; score?: string   // "2½", a string so ½ survives
}

interface EventModeTd {
  registered: number; unpaid: number; waitlisted: number; checkedIn: number
  resultsIn?: number; resultsTotal?: number; missingBoards?: number[]
  fixits: Array<{ code: 'round_times_missing'; text: string; href: string }>
}

interface EventModeItem {
  tournamentId: string; name: string; href: string
  viewer: 'player' | 'guardian' | 'td' | 'admin'
  phase: EventPhase; round?: number; roundsTotal: number
  nextRoundStart?: string   // ISO-8601 with the America/Chicago offset
  updatedAt: string         // same format
  players: EventModePlayer[]   // own entry, or one row per dependent
  td?: EventModeTd
  playersSee: string
  key: string               // `${tournamentId}:${phase}:${round ?? 0}`
}

interface EventModeResponse { items: EventModeItem[]; pollSeconds: 20 | 300 }
```

  `pollSeconds` is 20 in `checkin`, `eventDay`, `roundPosted`, `roundInProgress` and `between`, and 300 otherwise. Phase predicates, Phase 0: `eventEnd = (end_date ?? date) 23:59` Central; `week` = 6 days before day 1 at 6:00 AM until the day before; `dayBefore` = the calendar day before `date`; `checkin` = an event day from 6:00 AM until that day's first `round_schedule` time; `eventDay` = the rest of that day (Phase 0 only); `final` = `status = 'completed'` OR a non-null result in every section's last scheduled round; `after` = `final` until `eventEnd + 48 h`. After WS07: `checkin` ends at the round's `round_publications` row; `roundPosted`, `roundInProgress` and `between` come from `round_publications` and `live_state`; `eventDay` is never produced. Items are sorted so the event whose next moment is sooner comes first; the client renders only the first.
- `GET /api/live/now` (new, WS07; public, edge-cached 30 s): `{ tournamentId: string; name: string; href: string; round: number; roundsTotal: number; publishedAt: string }` or 204. Live while `live_state = 'live'` and the next round in `round_schedule` starts today (America/Chicago); off from the last published round's results-complete time until the next round's day. Drives the `LiveTag`, the Popular list's "Live now" row and the homepage live hero only.
- `GET /api/me` (change): the registrations query also selects `t.end_date, t.registration_url, t.is_visible, t.registration_status`, and `directedTournaments` also selects `end_date, registration_url`. The new fields are documented in the response so the client-side window gate and `todo.ts` can place multi-day events and exclude partner rows.

**Frontend (replace)**
- Change: `src/components/layout/Navbar.tsx`, `src/components/layout/Footer.tsx`, `src/App.tsx`, `index.html`, `functions/api/me.ts` (the four registration fields and two directed-event fields above).
- New: `src/lib/nav.ts` (sections, sheet, tabs with icons, `hideTabBar` routes, pages and synonyms for search), `src/lib/eventModeCopy.ts`, `src/lib/todo.ts`, `src/hooks/useEventMode.ts`, `src/components/layout/SearchTrigger.tsx`, `AboutMenu.tsx`, `MyLcaMenu.tsx`, `EventStrip.tsx`, `LiveTag.tsx`, `MobileAppBar.tsx`, `BottomTabs.tsx`, `BottomDock.tsx`, `MobileMenu.tsx`, `EventDock.tsx`, `EventBanner.tsx`, `src/components/search/SearchCombobox.tsx`, `SearchPanel.tsx`, `SearchResults.tsx`, `src/pages/SearchPage.tsx`, `functions/api/me/event-mode.ts`, `functions/utils/eventMode.ts`, `functions/utils/apiTypes.ts`.
- `AnnouncementBanner` keeps its place above the nav, and the event strip stacks below the header; `--header-h` measures all three when sticky.

**Acceptance criteria (replace 1 and 3–6, add 9–16)**
1. At 1024, 1280 and 1440 px the logo plate, all six sections, the Search button (icon plus the word "Search" at 1024 px) and Donate · Log in · Join LCA (or Donate · Renew · My LCA ▾) are visible with nothing overlapping the logo and nothing wrapping.
3. The mobile sheet opened from the Menu tab traps focus, returns focus to the Menu tab on close, and closes on Esc.
4. The event strip renders only for a signed-in registered player, guardian, TD or `lca_admin` of an LCA-run event inside its window; never for partner events, never for the public, never on checkout pages. Hiding it keys on `event:phase:round`, and a new round brings it back. The public Live tag renders only while `/api/live/now` returns an LCA event. Role-safety tests cover a guardian (own dependents only), a TD of another event, a plain member (204) and partner events (never returned).
5. Search returns grouped results in under 300 ms (p95, warm) for queries of 2 or more characters, can be driven entirely from the keyboard in the panel, the homepage box and `/search`, and never returns a person name.
6. Donate is reachable in one click on desktop and tablet (a text link in the tablet header); on phones it is the first of the three buttons after the section list in the Menu sheet (two taps). WS12 AC6 is amended to match (section 5.9).
9. No fixed element overlaps `<main>` content at 320, 360, 390, 768 and 1023px with the tab bar, the event bar and the Register bar in every combination; a focused control is never hidden under the header or the dock.
10. Posting a new round while a test page is scrolled mid-page causes no layout shift; the event bar gains a "New" tag and the status region announces once.
11. Every label rendered by the header, sheet, tabs and footer comes from `nav.ts`; the header and sheet render the same six sections in the same order; the first two tabs reuse the Tournaments and Clubs entries unchanged; the footer's links resolve to `nav.ts` entries by id; one label per destination holds across all of them ("Board & regions", "Bylaws & rules", "Minutes"); and the first tab reads "Tournaments".
12. The strip, the event bar and the banner show no countdown, no auto-updating visible text, no pulsing element, and no "R3" or "Bd 6" shorthand.
13. Tab from page load reaches "Skip to content" first; the tab bar is reachable after `<main>`; every footer link is reachable by keyboard at 390px with the folded columns.
14. axe reports zero serious or critical violations in light and dark on `/`, `/tournaments` and `/search` with the event strip and the tab bar mounted.
15. The brand link is named "Louisiana Chess Association, home" at rest and condensed.
16. Log in from the tab, the sheet and the desktop header returns the person to the page they were on.

**Tests (replace)**
- Unit `test/unit/eventMode.test.ts`: every phase in Phase 0 and after WS07; midnight, DST, multi-day events, `end_date` NULL; the `checkin` → `eventDay` switch each day; `final` for a completed event, for last-round results without completion, and for a completed event with no results; two events and the sooner-first rule; the `key` format.
- Unit `test/unit/eventModeCopy.test.ts`: every role × phase line in section 3 verbatim, ½, weekday dates, "7:00 PM", the "Players see:" echo equal to the player line, the button labels, no shorthand.
- Unit `test/unit/todo.test.ts`: one case per `membership_status`, unpaid entries for ended and upcoming events, children, US Chess expiry before an entered event, the "9+" cap.
- Unit `test/unit/nav.test.ts`: one label per destination; header and sheet sections in order; tabs reuse entries; footer links resolve by id; `hideTabBar` routes.
- Unit `test/unit/search.test.ts`: normalisation and the cache key; the synonym table; the name-like and ID-like query rule.
- Integration `test/integration/event-mode.test.ts`: role safety (a guardian sees only own dependents; a TD of another event sees nothing; a plain member, `lca_observer`, `lca_officer` and `lca_auditor` get 204; partner events never returned; TD counts never reach a player); ETag 304; items sorted sooner-first.
- Integration `test/integration/search.test.ts`: grouping and caps, no event in two groups, no member, registration, email or player-name field, champions rows with no name, identical output signed in and out.
- Integration `test/integration/me.test.ts`: the new registration and directed-event fields.
- a11y `test/a11y/nav.spec.ts`: AC1 at three widths; About menu by keyboard; sheet focus trap; skip link first; brand link name; axe light and dark on `/`, `/tournaments` and `/search` with the strip and tab bar mounted; footer links by keyboard at 390px and the fold's `aria-expanded`.
- a11y `test/a11y/dock.spec.ts`: no fixed element overlaps `<main>` at 320, 360, 390, 768 and 1023px with every bar combination; no layout shift when a round is posted mid-scroll, "New" tag and a single announcement; the dock hides with the keyboard open and on `hideTabBar` routes; the landscape reflow fallback.

**Depends on:** WS01. `eventStrip` (week, day before, check-in, event day, final and after states) can ship in Phase 0 on today's data; `final` is `status = 'completed'` or a non-null result in every section's last scheduled round. `eventStripLive` and `liveMarker` stay off until WS07 provides `round_publications`, `live_state` and `/api/live/now`.

### 5.6 WS03: changed subsections

**User-facing scope (replace item 1 and the identity-line sentence; items 2–7 stand, with the champions note below)**
1. **Hero ladder**, picked by data on the server in this order, first match wins (full table in `DESIGN_REPLAN_phase0.md` section 4): **Live** (WS07; live colour tokens on the hero only, no live fonts on `/`; round row in words, never "R3") · **Event day** (today is between an LCA event's `date` and `eventEnd`) · **Register, last call** (an `isOpen` or `isClosedOnline` LCA event starts within 14 days or early entry ends within 7) · **Results** (an LCA event with `eventEnd` within 7 days, `status = 'completed'` and a non-null result in every section's last scheduled round, else fall through; Heritage accent, winners by full name with ½; WS10's `event_results` once it exists) · **Register** (within 30 days or early entry within 14; Home-A's card with the primary by state: Register when `isOpen`, Join the waitlist when `isFull`, Event details when `isClosedOnline`, and a "You're entered" variant) · **Announced** (`isAnnounced`, within 60 days; "Email me when registration opens" signed in, Event details signed out) · **Week** (WS09) · **This week in Louisiana** (LCA and partner rows within 14 days, Louisiana only; partner rows only while the sync is fresh, LCA rows always) · **Quiet** (next LCA event card, the three soonest Louisiana events, a region select) · **Clubs** (the floor when nothing matches or `/api/home` fails). Registration state comes from `isOpen`, `isFull`, `isClosedOnline` and `isAnnounced` in `functions/utils/events.ts` (section 2, Q4), one unit test each. Exactly one primary action per mode. Every non-LCA mode ends with a "Next LCA event" line when one is announced within 180 days ("Registration open ›", "Registration opens Fri, Jan 15 ›" or "Details ›"). Partner rows carry "Partner event · Registers on the organizer's site ↗", never Register, never a count, never the LCA hall photo; a single `EventAction` component enforces this, and any `tournaments` row with a `registration_url` counts as organizer-registered; the "Also this weekend" partner line links to the organizer's site until WS04 ships the internal partner page. Personal lines are added on the client: "You're entered" and "You finished 4th" from `/api/me`, boards and colours from `useEventMode()`. While `/api/home` loads the hero reserves 360px at 390px and 440px at 1280px with a neutral skeleton; if it fails, the hero renders the Clubs floor from `regions.ts` with no error chrome. Below the hero in every mode is the **identity and search band**: the official logo, "Louisiana's chess community since 1915 · 300+ members · 25+ clubs · 7 regions" (each stat a link), a CSS thick–thin rule, and the Home-B search box (the WS02 combobox inline, visible label, quick-pick chips hidden until WS04 and WS09 ship their filters).
5. **Results & champions** (Home-D): the "Current champions" band ships in Phase 0 from `state_champions` with the Heritage accent, hidden when the newest title is more than 13 months old. The recap card waits for WS10.

**API (replace)**
`GET /api/home` (new, public). Its contract is `HomeResponse` in `functions/utils/apiTypes.ts`:

```ts
interface HeroEvent {
  id: string; name: string; href: string; city: string
  date: string; endDate?: string; dates: string   // "Sat–Sun, Jun 12–13"
  organizer?: string; format?: string; sections?: string[]
  tag: 'lca' | 'partner'; external?: boolean         // partner rows: organizer's site, new tab
}
interface LiveHero { mode: 'live'; event: HeroEvent; round: number; roundsTotal: number; publishedAt: string; nextRoundStart?: string
  rounds: Array<{ round: number; state: 'final' | 'live' | 'scheduled'; startsAt?: string }> }
interface EventDayHero { mode: 'eventDay'; event: HeroEvent; nextRound?: { round: number; startsAt: string } }
interface RegisterHero { mode: 'register' | 'lastCall'; event: HeroEvent
  registration: 'open' | 'full' | 'closedOnline'
  priceFrom?: number; memberSaving?: number; registered?: number; maxPlayers?: number
  earlyDeadline?: string; checkIn?: string; round1?: string; startsIn?: string; alsoThisWeekend?: HeroEvent }
interface ResultsHero { mode: 'results'; event: HeroEvent; isStateChampionship: boolean
  winners: Array<{ section: string; names: string[]; score: string }>; moreSections: number
  facebookHref: string; recapHref?: string; photosHref?: string }
interface AnnouncedHero { mode: 'announced'; event: HeroEvent; registrationOpensAt?: string; alsoThisWeekend?: HeroEvent }
interface WeekHero { mode: 'week'; range: string; meetings: number; clubs: number
  tonight: Array<{ time: string; club: string; place: string; href: string }>; weekend: HeroEvent[] }
interface NearbyHero { mode: 'nearby'; heading: 'This weekend in Louisiana' | 'Coming up in Louisiana'; events: HeroEvent[] }
interface QuietHero { mode: 'quiet'; events: Array<HeroEvent & { inDays: number }> }
interface ClubsHero { mode: 'clubs'; regions: Array<{ slug: string; name: string }> }
interface NextLca { event: HeroEvent; status: 'open' | 'opensAt' | 'details'; opensAt?: string }

interface HomeResponse {
  hero: (LiveHero | EventDayHero | RegisterHero | ResultsHero | AnnouncedHero | WeekHero | NearbyHero | QuietHero | ClubsHero)
    & { reason: string; nextLca?: NextLca }
  week: WeekHero | null                       // WS09
  upcoming: HeroEvent[]                       // Louisiana only in Phase 0, hero events excluded
  recap: { title: string; href: string; date: string } | null   // WS10
  champions: Array<{ year: number; title: string; name: string }> | null
  news: Array<{ id: string; title: string; date: string; href: string }>
}
```

No field in `HomeResponse` is personal. Mode selection is `selectHeroMode(now, data)` in `functions/utils/homeHero.ts`, in America/Chicago time, with the window constants `LAST_CALL_DAYS = 14`, `LAST_CALL_EARLY_DAYS = 7`, `REGISTER_DAYS = 30`, `REGISTER_EARLY_DAYS = 14`, `RESULTS_DAYS = 7`, `ANNOUNCED_DAYS = 60`, `NEARBY_DAYS = 14`, `NEXT_LCA_DAYS = 180`, `SYNC_STALE_DAYS = 3`. Events come from `functions/utils/events.ts` (the LCA + clearinghouse union moved out of `functions/api/clearinghouse.ts`). Partner rows are dropped when the newest `synced_at` is more than 3 days old or the start date has passed, and an admin alert is raised; LCA rows never depend on the sync. `eventEnd(t) = (t.end_date ?? t.date) 23:59` Central anchors every window. Edge cache 60 s, dropping to 15 s in the live and event-day modes. Every block degrades to `null` when its source isn't built yet.

**Frontend (replace)**
- Rewrite: `src/pages/HomePage.tsx`.
- New: `src/components/home/HomeHero.tsx` (one subcomponent per mode, each with a skeleton at the reserved height), `HeroEventCard.tsx` (lca, partner, compact), `NextLcaCard.tsx`, `EventAction.tsx`, `IdentitySearchBand.tsx`, `ThisWeekStrip.tsx`, `UpcomingList.tsx` (`excludeIds`), `DoorsBand.tsx`, `RecapCard.tsx`, `ChampionsBand.tsx`, `MembershipBand.tsx`, `src/lib/addToCalendar.ts`, `functions/utils/homeHero.ts`, `functions/utils/events.ts` (with `isOpen`, `isFull`, `isClosedOnline`, `isAnnounced` and `eventEnd`), `functions/api/home.ts`. The hero photo is `src/assets/LCA_Slide_1.jpg` through the WS01 pipeline, alt "Players at long tables in a tournament hall", unless K supplies another.
- Reuse: `FacebookFeed variant="compact"`, `StatusBadge`, `DateBlock`, `ThickThinRule`, `Seal`, `RegistrationReminderButton`, `SearchCombobox`.
- Removed: `HeroSlideshow` and the three equal columns.

**Acceptance criteria (replace 1, 4, 5 and 7; add 8–14)**
1. Mode selection is unit-tested for every rung, at every window boundary, for ties (earliest event), at midnight and across DST, for `end_date` NULL, for a stale sync with an LCA row in range, for a closed-online and an announced LCA event inside 30 days, for a completed event with no results, and for a last round finishing after midnight. A mode missing its data falls to the next rung, and no mode renders an empty frame.
4. Partner events never show Register buttons or counts in any mode; a partner-only fixture renders no "Register" text and no count. Out-of-state events never take the hero.
5. On a 390 px phone the order is hero, identity and search band, this week, upcoming, doors, results and champions, news, membership, matching `Home-Phones` with the band added. Nothing is hidden by hero mode.
7. If WS07, WS09 or WS10 data is missing, those blocks are absent; no empty frames or placeholder text reach production. Partner rows are absent when the clearinghouse sync is more than 3 days old.
8. The live hero has a visible "Pause updates" control, polls every 20 s only while the tab is visible, and shows "Updated hh:mm".
9. Personal lines ("You're entered", "Board 6 · White", "You finished 4th") never appear in the cached `/api/home` response.
10. The heritage font chunk never loads on `/`.
11. The live font chunk never appears in the `/` network log, in any mode, including the live hero.
12. While `/api/home` loads, the hero holds its reserved height and CLS stays under 0.1; when the request fails, the Clubs floor renders with no error text, and the lower blocks keep their error states.
13. The live hero's round row and every strip, bar and banner line carry no "R3"-style shorthand; the round row reads in words with every label in the DOM.
14. The inline search box opens its list only on click or Tab focus, never on page load, and the open list never shifts the page.

**Tests (replace)**
- Unit `test/unit/homeHero.test.ts`: every rung and boundary from AC1, ties, the Next LCA line's three statuses, the "Also this weekend" line, the registration-state primary per rung.
- Unit `test/unit/events.test.ts`: `isOpen`, `isFull`, `isClosedOnline`, `isAnnounced` and `eventEnd`, one case per clause.
- Integration `test/integration/home.test.ts`: a partner-only fixture renders no "Register" text and no count; no personal field; `null` blocks for unbuilt sources; cache headers per mode; out-of-state rows never in the hero; the Results rung with a completed, resultless event falls through.
- a11y and visual `test/a11y/home.spec.ts` (Playwright): a snapshot of each mode at 390 and 1280px; the phone order; the heritage and live font chunks absent from the `/` network log; the skeleton height and CLS; the fetch-failure Clubs floor; Pause updates in the live hero; the inline search overlay's open and focus rules.

**Depends on:** WS01 and WS02. The strip needs WS09 and is flagged off until then (`homeWeek`). Live mode needs WS07 (`homeLive`). The results hero (`homeResults`) and the Champions band (`homeChampions`) ship in Phase 0 from existing standings and `state_champions`; only the recap card waits for WS10 (`homeRecap`). WS03 no longer waits for WS04: it builds `functions/utils/events.ts`, which WS04 adopts.

### 5.7 Flags added to `src/lib/features.ts` (all default `false`, each with a plain comment)

| Flag | Turns on | Can go on in |
|---|---|---|
| `newLook` | WS01 base tokens, dark mode, focus ring, formats | Phase 0 |
| `themeHeritage` | About, Board, Bylaws, Minutes, Annual meeting and Champions in the Heritage Club look | Phase 0 |
| `themeScholastic` | Scholastic pages in the Bright Scholastic look | WS11 |
| `newNav` | the six-section header, My LCA menu, footer, tablet hybrid, and on phones the app bar, tab bar and sheet (one flag, so no combination leaves a phone without navigation) | Phase 0 |
| `siteSearch` | the header Search button, ⌘K panel and `/search` | Phase 0 |
| `homeSearch` | the search box in the homepage band | Phase 0 |
| `eventStrip` | the personal event strip on desktop and tablet in the week, day before, check-in, event day, final and after states (`final` = `status = 'completed'` or a non-null result in every section's last scheduled round) and, from check-in on day 1, the phone event bar and banner | Phase 0, after a preview check with a real registration |
| `eventStripLive` | the round posted, in progress and between states (board, colour, opponent), the public "Playing today" line on pairings and standings pages, and the admin "not marked completed" nudge | WS07 |
| `liveMarker` | the public "Live" tag on Tournaments | WS07 |
| `newHome` | the hero ladder (event day, last call, register, announced, this week, quiet, clubs) and the lower blocks | Phase 0 |
| `homeResults` | the final-standings hero for 7 days after an LCA event | Phase 0 |
| `homeChampions` | the current champions band | Phase 0 |
| `homeLive` | the live round hero | WS07 |
| `homeWeek` | the week view hero and this-week strip | WS09 |
| `homeRecap` | the recap card | WS10 |

### 5.8 Deviations to record in `REDESIGN_STATUS.md`

- WS01: Heritage loads Libre Caslon Display and Source Serif 4 instead of reusing Instrument Serif. Baloo 2 and Nunito move to WS11.
- WS02: the public event bar becomes a personal strip; `EventBar.tsx` becomes `EventStrip.tsx`; the "/" shortcut is dropped; the mobile layout is M2 under 768px; WS02 AC6 and WS12 AC6 get a phone exception (Donate is two taps on phones); the footer column list changes (section 5.5).
- WS03: three hero modes become ten; the window moves from 21 to 30 days with a 14-day last-call tier; results and champions ship before WS10 (section 6 asks K); `functions/utils/events.ts` moves from WS04 to WS03.
- WS12: AC6 reworded (section 5.9).

### 5.9 WS12: amended acceptance criterion

6. Donate is one click from every page on tablet and desktop; on phones it is the first of the three buttons after the section list in the Menu sheet (two taps).

---

## 6. Questions for K

Only questions that change what gets built. Each has a recommended default in bold. Two are marked optional: the document can decide them if K would rather not.

1. The header search becomes a field-shaped "Search" button that opens a panel, with the full box on the homepage, rather than H4's literal two-row header; **default: the button, since H4's second row plus the strip would take about a fifth of a laptop screen.**
2. During a live LCA round the public sees only a worded "Live" tag on Tournaments and the homepage's live hero, not the brief's public bar; **default: no public bar.**
3. The homepage live hero stays public (it is on the brief's board) while the header strip and phone pop-ups stay for involved people only; **default: public hero, with the personal "You're on board 6" line added only for signed-in involved people.**
4. (Optional) Do `lca_observer`, `lca_officer` and `lca_auditor` (the president, treasurer and other view-only roles) get the admin strip marked "View only"; **default: no, only `lca_admin` and the event's TDs, and the others open the event page.**
5. Do admins get the phone banner at each new round as well as the docked bar; **default: yes, because K named admins among the people who should see the pop-ups, and Dismiss is one tap.**
6. Heritage loads its own fonts (about 110 KB on six pages) instead of reusing Instrument Serif; **default: yes, since Instrument Serif cannot produce the small caps, text weights or ½ on the board K approved.**
7. Should `/membership`'s tier cards be Heritage, as the tile's "best for membership" suggests; **default: no, the chooser and Stripe checkout stay Minimal and only the member's card (and a card preview on `/membership`) is Heritage.**
8. Keep Bright Scholastic planned for `/scholastic/*`, built in WS11 and flagged off until K previews it; **default: keep it.**
9. The official logo sits on a small cream plate inside the navy header (D1 forbids recolouring and asks for white or cream); **default: cream plate, to be judged by eye on the preview.**
10. On phones, Donate is the first of the three buttons after the section list in the Menu sheet (two taps) rather than a link in the app bar; on tablets and desktop it stays one click; **default: accept two taps on phones and change WS02 AC6 and WS12 AC6 accordingly.**
11. The registration-open hero window is 30 days, with a last-call tier at 14 days and early-deadline overrides (14 and 7 days), instead of the brief's 21 days; **default: yes.**
12. (Optional) State champions are searchable by title and year only, never by name, and search shows the title and year without the name; **default: title and year only, since the name lookup already exists on `/champions`.**
13. The event strip takes the live colour tokens (not the live fonts) while a round is live; **default: yes, as K's "distinct theme to show stuff is live" on the one surface every page shares.**
14. The Results hero and the Champions band ship in Phase 0 from today's standings and `state_champions`, ahead of WS10's archive (the Results hero switches to WS10's snapshot when it lands); **default: yes, behind `homeResults` and `homeChampions`.**
15. H5's brand-gold band becomes a light gold tint before and after the event and the live tokens during rounds, so brand gold is never a text ground and the live state reads as different; **default: yes.**
16. H5's "in 19 min" countdown is dropped in favour of the absolute time; it could be kept as a once-a-minute update behind the same Hide button; **default: drop.**
17. M4's floating pill becomes a full-width bar docked directly above the tab bar, so it never covers content or the Register bar; **default: docked.**
18. On phones the event bar appears from check-in on day 1, not during event week (desktop shows the strip from 6 days out); the week is a card at the top of My LCA and on Home instead; **default: yes.**

**Decided here (no action needed from K)**
- The Broadcast tile's pulsing live dot is static, with the word "Live" carrying the meaning: K's no-auto-motion rule and WCAG 2.2.2 settle it.
- The first phone tab reads "Tournaments", not M2's "Events": WCAG 3.2.4 and the single `nav.ts` settle it.
- Children's full names appear in the results hero and the Champions band: D3 already allows names in results.
- The role-gated "Your tools" search group (Workspace, Admin tickets, Admin members as page links) is included: it breaks no rule and costs a few lines.

---

## 7. Boards worth drawing next

Combined screens that do not exist on the canvas and would help K sign off. One line each.

1. **Header × strip states at 1280px:** the H1 bar with the Search button and, under it, the strip in event week (gold tint), check-in (gold tint, "Not checked in yet"), round live (live tokens, sticky), between rounds and final; one row per role (player, guardian, TD with "Players see:", admin).
2. **Header at 1024px:** the full bar with "Search" as icon plus word, the About menu open with the "LCA on Facebook ↗" footer row, and the signed-in state (Donate · My LCA ▾ with the menu open, Renew in the Join slot).
3. **Condensed header on scroll:** 56px with the rook mark, the strip at 44px in a live state.
4. **Phone, 390×844, event day:** the app bar, a page, the docked event bar above the tab bar, and the in-flow banner, in player, guardian, TD and admin versions; plus the "New" tag state when the banner is held back.
5. **Phone, 320×568 and iPhone SE:** the same stack to check the bottom chrome at about 17% of the screen, with the safe area.
6. **Phone Menu sheet open** from the Menu tab, including the Donate · Log in · Join LCA row, role tools, the theme switch and "Hide event bar until the next update".
7. **Phone, signed out:** the Log in tab's login page with the reassurance copy.
8. **Tablet, 768×1024 and 1023px:** the hybrid header with Menu as a right drawer, and the compact one-line strip; the TD console's bottom action buttons unobstructed.
9. **Landscape phone under 480px tall:** the reflow fallback with M1's Menu button and no bottom stack.
10. **Homepage hero ladder at 1280px and 390px:** one frame per mode (event day, last call, results with the Heritage accent, register with the three variants, announced signed in and out, this week in Louisiana, quiet, clubs), each with the identity and search band beneath it and the "Next LCA event" line where it applies.
11. **Live hero with Pause updates** and the round progress row in words ("Round 3 · Live", never "R3") at 1280px and 390px, plus the personalised "You're on board 6" line.
12. **Search:** the header panel open at 1280px with every group (including Results, Champions by year, Your tools, the US Chess row), the inline homepage box with its visible label and open listbox, and `/search?q=` on a phone with type chips.
13. **Heritage About page and Bylaws reader** in light and dark, inside the base header and footer, with base buttons and status tags unchanged, to confirm the "controls never change" rule by eye.
14. **Heritage accent on home:** the identity band with the thick–thin rule and official logo, and the Champions band with the seal, both in Geist, to show what Heritage looks like at zero font cost.
15. **The Tournaments nav item with the "Live" tag** at every width, and the pairings page's "Playing today, or is your child? Find your name in the pairings below, or log in to see the board." line above the Find-your-name field for signed-out visitors.
16. **Footer F1 with F3's trust line** and the Appearance control at 1280px, and folded into tap-to-open groups at 390px (Contact open, the rest collapsed), since the fold is described but never drawn.
