// src/areas/clubs/suggestClub.ts
//
// What the page of Suggest a club and Start a club (WS09 step 30,
// src/pages/SuggestClubPage.tsx and SuggestClubForm.tsx) reads besides the
// rules of domain/clubs/newClub.ts: the words of the switch's question mark,
// and which side an address opens. Kept in a file of its own so each
// component file exports only components.
import type { ClubRequestKind } from '@domain/clubs/newClub'

/** What the switch's mark holds. */
export const SWITCH_HELP: ReadonlyArray<readonly [string, string]> = [
  ['Suggest a club', 'For a club that already meets and is not on the map yet.'],
  ['Start a club', 'For a club you would like to get going where you live.'],
] as const

/** The query that opens Start a club: /clubs/suggest?kind=start. Suggest a club is the address with none. */
export const START_QUERY = 'start'

/** Which side an address opens, by its kind query. */
export function kindOfQuery(value: string | null): ClubRequestKind {
  return value === START_QUERY ? 'start_club' : 'new_club'
}
