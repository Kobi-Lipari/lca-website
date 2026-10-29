# K's picks of Monday, October 19, 2026

The record of K's picks among the option boards on canvas pages 8, 9 and 13 to 16, and of K's answers to the eight questions that followed them. K picked on pages 8, 9 and 13 on Thu, Oct 15, 2026, and on pages 14, 15 and 16 on Mon, Oct 19, 2026. The answers came later on Mon, Oct 19, 2026. Section 7 of `../../DESIGN_REPLAN_phase2.md` holds the full record, with K's words beside each decision.

- `feedback.md`: K's picks and answers, verbatim.

The boards named here are in `../../canvas/boards`, and the canvas layout is `../../canvas/canvas.json`.

## What K decided, page by page

**Page 8 · Clubs directory.** `Clubs-H` and `Clubs-H-2` (round 3, one list, always whole). This answers the replan's question 11.

**Page 9 · Club page.** `Club-G` and `Club-G-2` (round 3, the club's own one-page site), which answers question 17. Most blocks on a club's page will sit empty until its club rep fills them in, so the page has to look finished with only the basics, and K offered to enter those. Read with Club-G's author line (the club's own rep keeps the page) and with the fee rule below, K's words keep the club rep: question 18's plan to retire `club_rep` does not go ahead, and question 20 is answered for the page (a club keeps a named rep who keeps it).

**Page 13 · Membership & giving.** `Member-E` and `Member-E-2` (benefits first), with Member-F's "What your dues do" section in place of Member-E's "What your dues fund". K did not name `Give-A`, the plain Give page.

**Page 14 · My LCA.**
- Frame: Int-A's single page for a person with no other role, and Int-B's left rail for a person with more than one. Int-C is not used.
- Default page: `Account-D`, because its Show my card button sits up top on a phone, where the card is shown to a director to scan, without taking over the page.
- Today: `Account-H` (an urgent band, then the rest by role), never opened first when it is empty, since most people's Today will say "Nothing needs you today".
- Family: `Account-I`. Events you direct: `Account-L`. Your region: `Account-N`. Board: `Account-P`, so officers keep Admin (view only). LCA admin: `Account-R`. The small roles (auditor, one-event director, president, club rep): `Account-S` and `Account-S-2`.
- Who may create a tournament: in three phases, below.

**Page 15 · Workspace & admin.**
- TD console: `Work-E`.
- My region: `Work-H`, with each club's own page from `Work-H-2`. Where it differs from Account-N on page 14, Work-H's drawings win.
- Admin: `Work-J`, for the health of the automations at a glance.
- Setup checklist: `Work-L`, without its jump list.

**Page 16 · Scoresheet scanner**, one pick per part:
1. Getting in and capture: `Scan-E`, with Scan-D's states, and the person signed in first.
2. The reading job: `Scan-G`. No live feed of the read, which saves API cost.
3. Review: `Scan-H`, with piece images in place of letters on the board.
4. Fixing a misread: `Scan-K`.
5. Save, share and export: `Scan-L`, saved privately at once as Scan-M does, with no Public option.
6. My games: `Scan-O`, with games outside tournaments shown well too.
7. Into the tournament: `Scan-Q` and `Scan-Q-2`, with scanning optional and several ways to verify a game.
8. The printed notation kit: `Scan-S`, with piece images in place of letters.

K asked what "it matches how news lists" meant: Scan-N grouped games by month, newest first, the way the News page's Latest list does. With Scan-O picked, nothing depends on it.

## Decided as drawn

`Clubs-H` and `Clubs-H-2`; `Club-G` and `Club-G-2`; `Account-I`, `Account-L`, `Account-N`, `Account-P`, `Account-R` and `Account-S`, each with its part 2; `Work-E`, `Work-H` and `Work-J`, each with its part 2; `Scan-G` and `Scan-K`.

## Redrawn to K's words, and why

- Club-G in its bare state, with only the basics and every optional block left out rather than shown empty: K expects most blocks to go unused for a while and wants the page to look good regardless.
- Member-E with Member-F's "What your dues do" section: K prefers F's section to E's.
- The My LCA hub, joining Int-A and Int-B: K wants A for a person with no other role and B for a person with more than one.
- Account-D on phones, with an empty Today folded to one line: the card is shown from a phone, and an empty Today should not take the first screen.
- Account-H with its empty state: most people's Today is empty, so the layout has to work for them too.
- Work-L without the jump list: it repeats the setup steps sidebar. A long step scrolls inside the middle section instead, so the sidebar stays in view.
- Scan-E with Scan-D's states: K prefers the look of D's states, and the person signs in first.
- Scan-H and Scan-S with piece images: K does not want lettered pieces, but flat pieces like the default board on the big chess sites.
- Scan-L with Scan-M's immediate private save and no Public option: K likes the immediate save, and nobody should be able to open a person's profile and see their games.
- Scan-O with games outside tournaments: those games must show well too.
- Scan-Q with scanning optional: scanning a scoresheet is never required, and a game can be verified several ways.

Until a redraw is on the canvas, the board it grows from, read with K's change as written here, is the reference.

## Working assumptions K confirmed

K, later on Mon, Oct 19, 2026: "everything else is fine as assumed". These were working assumptions and are now decided:
- The left rail appears only when a person holds a volunteer section (directing, region, board, admin, lookup). A person who holds only You, or You and Family, keeps one page.
- Under the rail, each entry opens its full room as its own page.
- An empty Today shrinks to one line, and My LCA opens on You with the card.
- Piece images come from an open-licensed set (cburnett, as lichess draws it), never chess.com's own art.
- A scan saves itself at once, privately, under Scan-L's finish card, and the photo is kept 30 days beside the game.
- A director's scan at the table lands in both players' My games, private.
- Games not linked to a tournament get their own group on My games.

## Who may create a tournament

K's phases, as K wrote them on Mon, Oct 19, 2026:
- **Now:** a standing director role for the community's trusted directors, who may always create their tournaments here, to test the site and spread its use; the president, who may always create tournaments and may assign a single-event director to a tournament the president drafted; and the admins, who can already create tournaments and whom K's answer to question 4 names beside the president.
- **Later:** regional representatives create tournaments for their region's clubs and appoint one-event directors.
- **Last:** every member may create a tournament. It is never listed on the public tournament pages, since a volunteer organization has no fast way to watch them, which keeps out spam. It has every other function and is shared by link.

K's answers to question 4, each in place of the default the question offered:
- A standing director's event is listed as soon as it is published. A notification goes to the LCA admins to review it after the fact, and nothing is ever held.
- The president, the admins and the regional representatives draft tournaments and assign one-event directors. No other officer does.
- For now only LCA admins, club reps, the president and standing directors may set an entry fee above $0. Anyone else who tries is told in plain words that LCA must first set up an account for them inside LCA's own Stripe account (a connected account, through Stripe Connect), so their money is kept apart from LCA's and reaches them. Standing directors may set fees, and are told the same thing about reaching their money.
- US Chess rating reports are available for every event. K asks to be told if there is a reason to restrict this.

## Still open, with their defaults

Silence keeps the default.
- **When the regional representatives start.** K's phases put them later; K's answer to question 4 names them beside the president and the admins. Default: from WS09's My region in Phase 3, where the replan already has the representative create a club's event (P2.19); until then the people in the first phase create tournaments.
- **Whose affiliate an unlisted event's rating report carries.** Today the director enters the affiliate ID and the Chief TD's US Chess ID on the event's report card, and only affiliate-authorized certified TDs can submit at US Chess. Default: the director's own affiliate, as today; LCA's affiliate ID only on events LCA lists.
- **How a standing director reaches fees before a connected account exists.** Every online payment on the site goes into LCA's own Stripe account today. Default: the fees are paid into LCA's account and LCA passes them on to the director, who is told so before setting a fee.
- **Whether a club rep also creates the club's events.** K's fee rule lets club reps charge, K's phases do not give them tournament creation, and Account-S-2 draws both ways. Default: none assumed; WS09 is Phase 3, so nothing being built now waits.
- **Give-A, the plain Give page.** Not named. Default: `Give-A` as drawn, the plain Give page drawn after K's note of Tue, Oct 13, 2026 that giving should be there as an option.

## Later on Mon, Oct 19: the two boards, in K's words

K looked at Account-Final-Hub and Club-Final-Bare and took the defaults on the affiliate stamp (LCA's number only on listed events and on events run by standing directors, the president, admins and representatives), on a standing director's fees waiting in LCA's account until a connected account exists, and on the regional representative approving a named-rep request with admins as the backstop.

On the club page's contact: "contact emails are to never be shared, this is how we maintain trust with the volunteers. we always use our go between method. in that i mean the regional rep email that manages them. the club itself is free and encouraged to provide their own email for people to contact outside of the lca platform perview, which lessens our reps burden. so, the contact section should go to that email, and then a fall back of the regional rep. then in that email to the regional rep, notify them that they are being contacted because the club has no connected email as of yet. we just direct the emails to the clubs instead of recording them in house like we usually do, its their business, we just make sure that connection exists. everything else looks good."

Reading: a contact email is never shown. The form sends to the club's own email when the club has given one, otherwise to the regional representative, whose copy says the club has no connected email yet. The messages are relayed, not stored the way support tickets are. The bare club boards are approved as drawn.

## Tue, Oct 20: member-created tournaments, in K's words

"Also, I think I like the idea of opening up the tournament creation to all the normal people too with the idea of not allowing any of our TD IDs on the rating sheet so we are not charged, etc. And the distribution by link instead of having to check for fradulence on the public tournament pages, etc. Anything else to check or talk through in this aspect? But, I would still like to do a bunch of testing, so this public access to tournament creation, etc should be a switch i can turn on and off as an lca admin."

Asked who may create, and ten points to settle, K answered: "Who? Any active LCA member. Make this how the scanner works too, only active LCA memberships. I like the organizer responsibility thing, I think it is also necessary for the people getting those links to participate in their tournaments that they are not officially run and rated LCA events, etc. Agreed on bullet 3, 4 (how ever I want to be able to see it as a LCA admin to see how often our services are being used and by who, etc), 5, 6, 7, 8, 9 (but don't leave them standed here, provide clear and concise info with a way to quickly and easily contact the LCA Admin), 10. All good."

Reading: section 7.9 of the phase 2 replan records the decisions.
