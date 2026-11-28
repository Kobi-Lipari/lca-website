// src/areas/clubs/components/EditorHelp.tsx
//
// The one club editor's Help: every explaining sentence the editor's boards
// print beside its fields, given out by part to the small question mark
// beside that part (HelpMark.tsx, K's decision 16), so no sentence sits
// beside a control and none takes room until a person asks for it. The
// entries are in the form's order; the logo's and the colour's entry is
// shared between the logo's mark and the colour's.
//
// The sentences say only what helps a person fill in the form, as K asked
// on Thursday, November 19, 2026. Two things follow a switch: the email's
// sentence follows clubEmailHidden, as the field's label does, and the
// colour's follows the new club pages (clubPagesOn), since those pages and
// today's draw a club with no color of its own differently. The contact
// name's term follows the new club pages too; its sentence is one.
//
// Help says "your club's" only to the club's own rep
// (`own`); anyone else who keeps the club, a region's representative or an
// LCA admin, reads "the club's". The editor gives the four choices once
// (EditorHelpWords, in src/areas/clubs/helpMarks.ts), and each part's mark
// reads them; a part drawn outside the editor draws no mark.
import { useContext } from 'react'

import { EditorHelpWords, type EditorWords } from '@/areas/clubs/helpMarks'
import { HelpMark, type HelpEntry } from '@/areas/clubs/components/HelpMark'

/** The logo's words, beside the logo. */
const LOGO_WORDS = 'Choose a picture. It is fitted and saved right away, without pressing Save and publish.'

/** The colour's words, beside the colour: what a club with none shows follows the new club pages. */
function colorWords(pagesOn: boolean): string {
  return pagesOn ? 'The club\'s own color. A club with none shows navy.' : 'The club\'s own color. A club with none shows LCA\'s gold.'
}

/** Each field and what it is for, in the form's order, then the previews. */
function sentences(own: boolean, emailHidden: boolean, pagesOn: boolean, showAdmin: boolean): Array<[string, string]> {
  // "Your club" only to the club's own rep; anyone else who keeps the club reads "the club's".
  const clubs = own ? 'your club\'s' : 'the club\'s'
  const clubsAtStart = own ? 'Your club\'s' : 'The club\'s'
  return [
    [
      'One sentence about the club',
      `Say what the club is in one sentence. It shows as About on ${clubs} page, and its beginning shows in search results. You can write up to 2,000 characters.`,
    ],
    [
      'How the club meets, in words',
      'The days, the time and the place, as the club says them, such as "First and third Tuesdays at 7:00 PM". Keep it short.',
    ],
    [
      'Where',
      'The place the club meets, its street if you know it, and a note such as the room. Set the pin yourself: click the map, drag the pin, or paste coordinates or a Google Maps link. If the club meets in two places, press Add another place. To take the second place off, press Remove place 2, then save.',
    ],
    [pagesOn ? 'Contact name shown on the page' : 'Contact name', 'The person a visitor should ask for.'],
    [
      'Email for messages',
      emailHidden
        ? 'LCA can reach the club at this address. Visitors never see it.'
        : `Messages for the club are sent to this address. Visitors can see it on ${clubs} page.`,
    ],
    [
      'Name and address',
      `The city shows under ${clubs} name and helps people find a club near them. The page's web address stays the same if the club is renamed, so old links keep working.${showAdmin ? '' : ' To change the name, the region or the web address, ask an LCA admin.'}`,
    ],
    ...(showAdmin
      ? [['Club name, region and page address', 'Only LCA admins can change these. The region decides which regional representative manages the club.'] as [string, string]]
      : []),
    [
      'Cost and who is welcome',
      'Cost: what a club night costs, such as "Free" or "$5 toward the room". Who is welcome: who the club is for, and what a first-timer should bring or ask for. Tick a box only when it is true of the club.',
    ],
    [
      'Links',
      `Paste the whole web address, starting with https://, such as ${clubs} Facebook page. Leave a box empty if the club has no such page.`,
    ],
    ['Logo and club color', `${LOGO_WORDS} ${colorWords(pagesOn)}`],
    [
      'Today\'s page shows different words here',
      `${clubsAtStart} page shows different words than this box holds. Saving puts this box's words on the page in their place, so read both before you save.`,
    ],
    [
      'Save and publish',
      `Your changes show on ${clubs} page right away. If you are not the club's regional representative, the representative gets an email saying what changed. Search results can take a few days to catch up.`,
    ],
    [
      'Preview',
      'How the club looks in a search result, when its link is shared, and on its card in the club directory. It changes as you type.',
    ],
  ]
}

/** The parts of the editor that carry a mark. */
export type EditorPart =
  | 'about' | 'howWeMeet' | 'where' | 'contactName' | 'email' | 'nameAndAddress' | 'adminFields'
  | 'cost' | 'links' | 'logo' | 'color' | 'differs' | 'save' | 'preview'

/** Which part each entry of the list stands beside, by its term. The logo's and the colour's entry is shared. */
const PART_OF: Record<string, EditorPart> = {
  'One sentence about the club': 'about',
  'How the club meets, in words': 'howWeMeet',
  'Where': 'where',
  'Contact name shown on the page': 'contactName',
  'Contact name': 'contactName',
  'Email for messages': 'email',
  'Name and address': 'nameAndAddress',
  'Club name, region and page address': 'adminFields',
  'Cost and who is welcome': 'cost',
  'Links': 'links',
  'Today\'s page shows different words here': 'differs',
  'Save and publish': 'save',
  'Preview': 'preview',
}

/** The entries one part's mark holds. */
function entriesFor(part: EditorPart, { own, emailHidden, pagesOn, showAdmin }: EditorWords): HelpEntry[] {
  if (part === 'logo') return [['Logo and club color', LOGO_WORDS]]
  if (part === 'color') return [['Logo and club color', colorWords(pagesOn)]]
  return sentences(own, emailHidden, pagesOn, showAdmin).filter(([term]) => PART_OF[term] === part)
}

/** Each mark's name after "Help: ": the entry's term, or the control's own label where the entry is shared. */
function nameOf(part: EditorPart, entries: readonly HelpEntry[]): string {
  if (part === 'logo') return 'Logo'
  if (part === 'color') return 'Club color'
  return entries[0][0]
}

/** The mark beside one part of the editor, with that part's words; none outside the editor, and none for a part with no words. */
export function EditorHelpMark({ part, tight, align }: { part: EditorPart; tight?: boolean; align?: 'start' | 'end' }) {
  const words = useContext(EditorHelpWords)
  if (!words) return null
  const entries = entriesFor(part, words)
  if (entries.length === 0) return null
  return <HelpMark name={nameOf(part, entries)} entries={entries} tight={tight} align={align} />
}
