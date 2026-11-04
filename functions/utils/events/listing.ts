// functions/utils/events/listing.ts
//
// Which events a public list shows: the one listing condition (D26), the
// only place a public query of tournaments decides what is listed. Today's
// rule is that every event is listed but a hidden draft, so a listed event
// is a row whose is_visible column holds 1. WS03 builds the shared event
// query beside this file, and WS08 extends the rule for the events members
// create, which keep every other function of an event but are never listed.
//
// The search's reads (functions/utils/search.ts) take the condition from
// here, and test/unit/listing-rule.test.ts holds them to it. Seven older
// public queries still write the rule themselves until WS03 moves them:
// two in functions/api/tournaments.ts, one in functions/api/clearinghouse.ts,
// two in functions/api/champions.ts, one in functions/api/clubs/[id].ts and
// one in functions/tournaments/[id].ts, the event page's link preview.

/** A table's name or its alias in a query: a letter or an underscore, then letters, digits and underscores. */
const SQL_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * The listing condition for the tournaments table under `alias`, as a piece
 * of SQL for a prepared statement's WHERE clause: for listedWhere('t'), that
 * t's visible flag is set. The alias is the only text it writes into a
 * query, so anything but a plain name is refused rather than written.
 */
export function listedWhere(alias: string): string {
  if (!SQL_NAME.test(alias)) throw new Error(`listedWhere takes a table's name or alias, not "${alias}"`)
  return `${alias}.is_visible = 1`
}
