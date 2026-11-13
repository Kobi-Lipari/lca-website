// functions/utils/clubs/pages.ts
//
// The server half of the clubs switches: three constants and their comments,
// and nothing else. The functions and the workers cannot read
// src/lib/features.ts, so each switch there that changes what the server
// answers has its constant here, set in the same change that turns the
// switch on. test/unit/club-pages-switch.test.ts holds each pair equal and
// holds the order they may be turned on in, through switchOrderProblems in
// src/areas/clubs/switches.ts.
//
// Each caller imports a constant from this file and reads it inside the
// function, at each call, never copied into a variable of its own module, so
// a test can turn it on through a getter on the mocked module. Nothing here
// reads a setting of the server's surroundings, and nothing is imported.

/**
 * Set: the public clubs directory and club pages on the server: the 301s from
 * today's club addresses, the club page written into the HTML, the sitemap's
 * club pages, the relayed Contact form and the other public club forms.
 * Turned on with newClubs in src/lib/features.ts, in the same change, and
 * only once newLook and clubEmailHidden are on;
 * test/unit/club-pages-switch.test.ts holds the two equal and the order.
 */
export const CLUB_PAGES_ON = false

/**
 * Set: the one club editor, Your club's page, My region, Still accurate and
 * the monthly check, for a club's rep, the region's representative and the
 * LCA admins. Turned on with clubKeepers in src/lib/features.ts, in the same
 * change, and only once clubEmailHidden is on with CLUB_EMAIL_HIDDEN;
 * test/unit/club-pages-switch.test.ts holds the two equal and the order.
 */
export const CLUB_KEEPERS_ON = false

/**
 * Set: a regional representative creates, names the director of and runs the
 * events of the clubs in their region, each waiting for an LCA admin's
 * approval before it lists. Turned on with regionEvents in
 * src/lib/features.ts, in the same change, and only once clubKeepers is on;
 * test/unit/club-pages-switch.test.ts holds the two equal and the order.
 */
export const REGION_EVENTS_ON = false
