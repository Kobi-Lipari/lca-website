// src/areas/clubs/repRequestRows.ts
//
// What the keeper's rows of Ask to be its named rep (WS09 step 31,
// src/areas/clubs/components/RepRequestRows.tsx) share with My region and a
// club in My region: the list's heading and the words of its question mark,
// kept in a file of their own so the component's file exports only
// components. The rows' other words are domain/clubs/repRequest.ts's, which
// the server reads too.

/** The list's heading. */
export const REP_REQUEST_ROWS_HEADING = 'Rep requests'

/** What the list's mark holds. */
export const REP_REQUEST_ROWS_HELP: ReadonlyArray<readonly [string, string]> = [
  ['Rep requests', 'A member asked to be named this club\'s rep from the club\'s page. Write to them to check, then name them or decline. They get an email either way.'],
  ['Name as rep', 'They become the club\'s rep: they can edit its page, create its events and set their fees. A member who holds another role is the LCA admins\' to name.'],
] as const
