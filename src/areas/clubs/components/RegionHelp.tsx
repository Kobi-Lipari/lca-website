// src/areas/clubs/components/RegionHelp.tsx
//
// My region's Help (WS09 step 11): every sentence that explains the page,
// given out by part to the small question mark beside that part
// (HelpMark.tsx, K's decision 16), so none sits beside a control and none
// takes room until a person asks for it. Three marks hold today's seven
// entries, word for word: the This month bar's heading holds the monthly
// check and the 90 days, Confirm all still accurate holds its own, and the
// Clubs heading holds what the page is, Still accurate, Open and who sees
// the stamps. No club's card carries a mark.
//
// It says only what is true with clubKeepers on today: what Still accurate
// and Confirm all do, what the 90 days mean and where the stamps show, and
// that the bar names the day the next monthly check is due. It names no
// hour and says nothing of what the monthly check does or sends, since
// nothing runs it until a later step. An LCA admin never reads "your
// region".
import { HelpMark, type HelpEntry } from '@/areas/clubs/components/HelpMark'

/** Each part of the page and what it does. */
function sentences(isAdmin: boolean): Array<[string, string]> {
  const whose = isAdmin ? 'every region\'s clubs' : 'the clubs your seat keeps'
  return [
    [
      'What this page is',
      `A card for each of ${whose}, with when each was last checked. A check tells LCA that a club's listing is still right.`,
    ],
    [
      'Still accurate',
      'Press it on a club\'s card when its listing is still right. The card\'s stamp then names this month. Saving the club\'s listing counts as a check too.',
    ],
    [
      'The 90 days',
      'A club needs a check when nobody has marked it still accurate or saved its listing in the last 90 days. When the page opens, those clubs come first, with "Not checked since" and the month, or "Not checked yet", on an amber tint. The others follow in A to Z order.',
    ],
    [
      'Confirm all still accurate',
      'It marks every club that needs a check as still accurate, one club after another, once you answer its question. If a club cannot be marked, it is named and left as it was.',
    ],
    [
      'The monthly check',
      'The bar names the day the next monthly check is due.',
    ],
    [
      'Open',
      'Open takes you to the club\'s listing, where you can change it.',
    ],
    [
      'Who sees the stamps',
      'Only this page shows them. No public page shows when a club was checked.',
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
