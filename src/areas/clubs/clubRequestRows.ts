// src/areas/clubs/clubRequestRows.ts
//
// What the keeper's rows for Suggest a club and Start a club (WS09 step 30,
// src/areas/clubs/components/ClubRequestRows.tsx) share with My region: the
// words of the list's question mark and of the question Mark as handled
// asks, kept in a file of their own so the component's file exports only
// components.

/** What the list's mark holds. */
export const CLUB_REQUEST_ROWS_HELP: ReadonlyArray<readonly [string, string]> = [
  ['New clubs to check', 'Someone sent each of these from Suggest a club or Start a club. Write to them to check the details, then mark it as handled.'],
  ['Mark as handled', 'Their name and email address are taken off the row. The club\'s name, the place and their words stay.'],
] as const

/** The question Mark as handled asks first. */
export const MARK_HANDLED_QUESTION = 'Mark as handled? The person\'s name and email address are removed from this row.'

/** What the list's status says once a row is marked, after the club's name. */
export const MARKED_HANDLED = 'Marked as handled. Their name and email address were removed.'
