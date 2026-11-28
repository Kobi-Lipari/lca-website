# K's feedback on canvas pages 8 (Clubs directory) and 9 (Club page), October 9

K asks for another round of design options on both pages, focused on these points.

## Verbatim

8. I am leaning toward C or D since  I dont like a calendar for this. And I like having a map for this, to better help what clubs are nearby you. maybe we go to another design step for this focusing on this feedback so i can see the new options and have a better idea of how to help further

9. I like the club mini site vision for this best, but take into mind i dont think we will do a leaderboard, because like previously stated, normally players are not associated with a club, that was there in the admin page to give the club managaers access to editing the club page when we were doing it that way (maybe we can retire this type of designation in the admin page now since only regional reps will have access to editing their clubs now). Lets get anotehr stage of design options focusing on these points.

## Reading
- Page 8: no calendar view; the map is central (which clubs are near you); new options grow from C and D.
- Page 9: the club mini-site direction wins; no leaderboard; players are not associated with clubs. The club-member designation in the admin existed only to let club managers edit their club page; K suggests retiring it since regional reps will edit clubs. Question to settle: what "regional rep" means in the data model and what happens to club_rep and members.club_id (the lead's decision 5 on requires_lca_membership names the club rep).

## Round 3 request (page 8), Tue, Oct 13, 2026

Verbatim: "we need to do another round of option and designing for option 8 (the club directory). I like the direction that club E is going but it looks far too convoluted and messy. lets iterate on that while also taking into mind that this clubs page should also empower people to not only see clubs around them but also discover all of the other clubs, etc."

Reading: Clubs-E's direction (the map is the page, with the list beside it) is the one to keep; the next options grow from E only. They must be plainly simpler: fewer controls on the first screen, no overlapping panels, nothing a first-time visitor has to decode. And the page must serve two jobs equally: "which clubs are near me" and "show me every club in Louisiana", so a visitor who is not looking for the nearest club can still browse all 25.

## Round 3 request (page 9), Tue, Oct 13, 2026

Verbatim: "on 9, something these  designs are not taking into account is that we very rarely have up to date information from our clubs, so our design should not attempt to leverage accurate weekly information, but rather give the opportunity to the club reps to be able to advertise their club well without having to have their own website (so SEO is a must here for their club names etc). more iteration is requiresd on these designs"

Reading:
- LCA rarely has current information from its clubs, so neither page may be built on weekly accuracy. Out go the computed "Next: Wed, Oct 7 · 6:00 PM" headlines, "Tonight" and "Meets today" states and counts, "Meets soonest" sorts, and freshness loops as the organising idea. A club states how it meets in its own words (pattern, venue, typical times, where changes are announced), and the site shows that as the club's statement, not as a fact it vouches for week by week. Events the club runs on this site are the exception: those are reliable because they live here.
- The club page is the club's own advertisement: a place where a club rep can present the club well without a website of their own. It must stand in for a website: a durable address with the club's name in it, the club's name in the page title, a description, photos, contact, links to Facebook or a site if the club has one, and the club's events and news.
- SEO is a must: a stable URL slug from the club name, title and description tags from the page's own text, Open Graph and a share image, structured data, server-rendered HTML for crawlers and link previews, a sitemap entry and a canonical link. A rep should be able to see how the page shows up in a search result.
- K wrote "club reps". That reopens the maintainer question: the page's author is the club's own representative, with the regional representative and LCA admins as backstops. Whether that is the existing club_rep role or a named contact per club is for K to confirm (question 20 in the replan); the boards show the club's rep as the author and say so.
- The page 8 directory follows the same rule: a listing shows the club's stated meeting pattern as text, never a computed next date, a tonight state or a count of clubs meeting today.

## Round 2 request (page 13, Membership & giving), Tue, Oct 13, 2026

K, verbatim: "for 13, do not lean in too hard to the donation page, we are service focused. people mainly donate by participation. but it should be there as an option. also, i like membership B best, but we need to iterate many more times for options on this to get exactly my best vision"

Reading:
- Giving is secondary everywhere: no donation hero, no giving tiers above the fold, no guilt or urgency copy. One quiet "Give" option on the membership page (a card or a line near the end) and a plain /give page is enough. The association is service-first: dues and entry fees are how most people support it, and the page should say so in plain words.
- Member-B is the base. Every new option grows from Member-B; A and C are not revisited.
- "Iterate many more times": draw several variants (not two or three), each a distinct reading of B, so K can point at exact pieces. Keep what B does, change one axis per option, and label the axis on the board.
- Standing rules still apply: keep the "300+ members" stat; no financial-need questions; no grade or birthdate; dues in plain language; "US Chess" never USCF.

## Round 2 request (page 14, My LCA account), Tue, Oct 13, 2026

K, verbatim: "for 14, I really like the ideas behind the today across your roles section, but we will need to expand this out to see how every  section will look and be very intentional about this to make it work and not look foolish. I agree that this would be a good place to host all of a members additional roles and rtheir stuff, instead of letting them see the admin panel, etc (im not sure how you were planning on doing that yet, im just refering to how it used to be).  I really like the on this page section so you can manage the family, etc. C is a good thing to work off of but we should not have it as default since most people will only have the you section. so we need to create a good default, and then lets make the one account many roles thing and envision what each section of it will look like. i expect options for each."

Reading:
- Account-C ("one account, many roles") is the base, but not the default view. Most members hold only the "You" section, so the default is a plain, good single-role page; the role sections appear only for the people who hold those roles.
- "Today across your roles" stays as the idea, and every section it can hold must be drawn out in full, one by one, with care: You (membership, family, entries, card), Guardian (the family), Tournament director, Club rep (if K keeps that author role from page 9), Regional representative, Board officer, LCA admin, and whatever else a member can hold. K wants to see what each looks like, not a sketch of the frame.
- My LCA hosts a member's additional roles and their work, in place of sending them to the admin panel. How that happens is open ("im not sure how you were planning on doing that yet"), so the boards must show the mechanism: what a role section holds, what still lives in a separate admin or workspace area, and how a person moves between them.
- The "On this page" section (the jump list that lets a person manage the family and so on) is kept.
- "I expect options for each": the default page gets options, and each role section gets options too. Draw them as separate boards so K can pick per section.

## Round 2 request (page 15, Workspace & admin), Tue, Oct 13, 2026

K, verbatim: "for 15, it seems all the pages here are all their separate ideas and are good on their own right, i think its proper to think about how we plan to integrate each of them into the whole and also get mockup options for each to pin down a good vision."

Reading:
- The four Work boards (TD console, club rep workspace, admin home and queues, setup checklist) are accepted as ideas. What is missing is the whole: how each screen is reached, how they relate to My LCA (page 14, where K wants a member's roles hosted) and to each other, who sees which, and how a person moves between them without a mode switch.
- So pages 14 and 15 are one design problem: the account hub (My LCA), the working screens (console, setup, the representative's My region, the board inbox) and the admin area. The round must first draw the integration itself as options (the map of areas, routes and the header), then mockup options for each screen inside that frame.
- "Mockup options for each": each of the four Work screens gets options too, redrawn where the replan changed them (Work-B is the regional representative's My region now, not a club rep workspace; the setup checklist has no member discount and carries the membership switch; the console carries player reports and the Recap tab).

## Round 2 request (page 16, Scoresheet scanner), Tue, Oct 13, 2026

K, verbatim: "for 16, i actually really like everything you have going on here, but kinda like previous things, these are not actually options to pick from but rahter different parts. these are all great, but please fully flesh out all the parts of this and also make options of them to pick from to help with vision etc."

Reading:
- Scan-A and Scan-B are accepted as parts of one scanner, not as rival options. Nothing is turned down.
- The round must first name every part of the scanner end to end (how a person gets in, capture, the recognition and the move-by-move check, fixing a misread, saving and exporting, the library of scanned games, how a scanned game reaches a tournament's results or a recap, offline and failure states, phones), then draw each part in full, and give each part options to pick from.

