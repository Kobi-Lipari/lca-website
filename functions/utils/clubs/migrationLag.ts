// functions/utils/clubs/migrationLag.ts
//
// The site's build can reach production before the migration run that adds
// a table or column it reads, or the run can fail and wait to be run again.
// A path that is live with every switch off (the member delete, the club
// delete, the club create) reads migration 0066's tables and columns, so
// each catches the error a missing one gives, writes one log line that
// names no club and no person, and goes on as it did before 0066, as the
// member delete does for the mail tables of 0060. Any other error is not
// caught.

/** True when a D1 error says a table or a column is not there: "no such table: x" or "no such column: x". */
export function isMissingTableOrColumn(err: unknown): boolean {
  const said = (e: unknown): string => (e instanceof Error ? `${e.message} ${e.cause === undefined ? '' : said(e.cause)}` : String(e))
  return /\bno such (?:table|column)\b/i.test(said(err))
}
