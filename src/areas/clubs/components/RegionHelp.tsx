// src/areas/clubs/components/RegionHelp.tsx
//
// My region's Help (WS09 step 11): every sentence that explains the page,
// given out by part to the small question mark beside that part
// (HelpMark.tsx, K's decision 16), so none sits beside a control and none
// takes room until a person asks for it. Three marks hold the seven
// entries: the This month bar's heading holds the monthly check and the 90
// days, Confirm all still accurate holds its own, and the Clubs heading
// holds what the page is, Still accurate, Open and who sees the stamps. No
// club's card carries a mark.
//
// The sentences say only what helps a person use the page, as K asked on
// Thursday, November 19, 2026. An LCA admin never reads "your region".
import { HelpMark, type HelpEntry } from '@/areas/clubs/components/HelpMark'

/** Each part of the page and what it does. */
function sentences(isAdmin: boolean): Array<[string, string]> {
  return [
    [
      'What this page is',
      isAdmin
        ? 'A card for each club, in every region, with when its listing was last checked.'
        : 'A card for each club in your region, with when its listing was last checked.',
    ],
    [
      'Still accurate',
      'Press it when the club\'s listing is still right. Saving the listing counts as a check too.',
    ],
    [
      'The 90 days',
      'A club needs a check when nobody has pressed Still accurate or saved its listing in the last 90 days. Those clubs come first.',
    ],
    [
      'Confirm all still accurate',
      'Marks every club that needs a check as still accurate, after asking you once. A club that cannot be marked is named and left as it was.',
    ],
    [
      'The monthly check',
      'The day the next monthly check is due.',
    ],
    [
      'Open',
      'Opens the club\'s listing, where you can change it.',
    ],
    [
      'Who sees the stamps',
      'Only My region shows when a club was checked. No public page does.',
    ],
  ]
}

/** The parts of My region that carry a mark: the bar's heading, Confirm all and the Clubs heading. */
export type RegionPart = 'month' | 'confirmAll' | 'clubs'

/** Each mark's name after "Help: ", as its heading or button says it, and the terms of the entries it holds, in the order it shows them. */
const MARKS: Record<RegionPart, { name: string; terms: readonly string[] }> = {
  month: { name: 'This month', terms: ['The monthly check', 'The 90 days'] },
  confirmAll: { name: 'Confirm all still accurate', terms: ['Confirm all still accurate'] },
  clubs: { name: 'Clubs', terms: ['What this page is', 'Still accurate', 'Open', 'Who sees the stamps'] },
}

/** The entries one part's mark holds. */
function entriesFor(part: RegionPart, isAdmin: boolean): HelpEntry[] {
  const all = new Map(sentences(isAdmin))
  return MARKS[part].terms.map((term) => [term, all.get(term) ?? ''] as const)
}

/** The mark beside one part of My region, with that part's words. */
export function RegionHelpMark({ part, isAdmin, align }: { part: RegionPart; isAdmin: boolean; align?: 'start' | 'end' }) {
  return <HelpMark name={MARKS[part].name} entries={entriesFor(part, isAdmin)} align={align} />
}
