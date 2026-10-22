// src/lib/badgeStatus.ts
//
// The statuses a StatusBadge can show, and the words each shows when its
// caller gives none. It lives outside src/components/StatusBadge.tsx so that
// file exports components and types only: a module that mixes the two loses
// Fast Refresh for everything in it, and the linter's only-export-components
// rule says so (src/areas/events/tournamentStatus.ts sits apart for the same
// reason).
//
// The words come from the boards where a board names them: "Registration
// open", "Waitlist", "Partner event" and "LCA event" from the Looks-3 Minimal
// tile, "Event full" from Event-Final-States, and "Live" from the tile's
// "Live · Round 3", whose round a caller adds. No board names a default for
// every status, so the other two keep the words the fixture page already
// used: "Opens soon" (a caller that knows the date writes "Opens Mon, Oct 12",
// as the tile does) and "Registration closed" (the tile's "Closed" sits among
// other registration tags, which a badge on its own does not).

/** Every status a StatusBadge can show, in the order the boards list them. */
export const BADGE_STATUSES = ['open', 'soon', 'full', 'waitlist', 'closed', 'live', 'partner', 'lca'] as const

/** One status a StatusBadge can show; each has its pair of status tokens in src/index.css. */
export type BadgeStatus = (typeof BADGE_STATUSES)[number]

/** The words a status badge shows when its caller gives none. */
export const STATUS_LABELS: Readonly<Record<BadgeStatus, string>> = {
  open: 'Registration open',
  soon: 'Opens soon',
  full: 'Event full',
  waitlist: 'Waitlist',
  closed: 'Registration closed',
  live: 'Live',
  partner: 'Partner event',
  lca: 'LCA event',
}
