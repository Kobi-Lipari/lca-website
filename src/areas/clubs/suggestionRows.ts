// src/areas/clubs/suggestionRows.ts
//
// What the keeper's rows for visitors' suggestions (WS09 step 28,
// src/areas/clubs/components/SuggestionRows.tsx) share with the pages that
// draw them: a row's shape, the words of the list's question mark, and when
// a page draws the list.
import { useState } from 'react'

import type { OpenSuggestion } from '@domain/contracts'

/** A row as the list draws it: the suggestion, with its club. */
export interface SuggestionRow extends OpenSuggestion {
  clubId: string
  clubName: string
}

/** What the list's mark holds. */
export const ROWS_HELP: ReadonlyArray<readonly [string, string]> = [
  ['Suggestions', 'A visitor sent each of these from the club\'s page. Fix the listing, reply, or choose Not an issue. Until each is answered, the club cannot be marked still accurate.'],
  ['Reply', 'Your reply goes to the visitor from LCA\'s own address, so they never see yours and you never see theirs.'],
] as const

/**
 * Whether the page draws the list: from the first draw that has a row, and
 * on after its last row has gone, so its status and its heading, where the
 * focus goes, stay on the page. With no row from the start it is never drawn.
 */
export function useRowsShown(hasRows: boolean): boolean {
  const [ever, setEver] = useState(hasRows)
  if (hasRows && !ever) setEver(true)
  return ever || hasRows
}

