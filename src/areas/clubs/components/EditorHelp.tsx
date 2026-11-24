// src/areas/clubs/components/EditorHelp.tsx
//
// The one club editor's Help: every explaining sentence the editor's boards
// print beside its fields, given out by part to the small question mark
// beside that part (HelpMark.tsx, K's decision 16), so no sentence sits
// beside a control and none takes room until a person asks for it. The
// sentences are today's list, word for word, in the form's order; the logo's
// and the colour's entry is shared between the logo's mark and the colour's,
// at the end of the logo's two sentences.
//
// From WS09 step 8 it also holds the sentences for the rest of the listing
// and the preview column: what About's count means and that a search result
// shows the start of About and then how the club meets, about 155
// characters in all, which holds only while how the club meets is short, so
// Help asks for it short (domain/clubs/pageMeta.ts), the city's line and the
// page's address, the cost, who is welcome and the two ticks, the links, the logo
// and the colour, and what each preview shows.
//
// The email's sentence follows clubEmailHidden, as the field's label does:
// only while that switch is on does Help say the address is never shown.
// The contact name's, the note's and Save and publish's sentences follow the
// new club pages (clubPagesOn) the same way: today's club page shows neither
// the contact name nor the place's note, so until those pages are on Help
// says what goes live on today's page at once and what shows once they open.
// The cost, who is welcome, the two ticks and the three links follow it too,
// since today's club page and directory read none of them, and so does
// Preview, which draws the new pages' search result, share and card; and so
// does the city's sentence, since today's page shows the city under the
// name as "Baton Rouge, LA" and not the new pages' line, and so do the
// sentences on the page's address, since today's page keeps the club's id
// as its address until the new pages open.
//
// Help speaks of "your club" and "your page" only to the club's own rep
// (`own`); anyone else who keeps the club, a region's representative or an
// LCA admin, reads "the club's". The editor gives the four choices once
// (EditorHelpWords, in src/areas/clubs/helpMarks.ts), and each part's mark
// reads them; a part drawn outside the editor draws no mark.
import { useContext } from 'react'

import { addressCardName } from '@/areas/clubs/editor'
import { EditorHelpWords, type EditorWords } from '@/areas/clubs/helpMarks'
import { HelpMark, type HelpEntry } from '@/areas/clubs/components/HelpMark'

/** The logo's two sentences, beside the logo, and the colour's one, beside the colour. */
const LOGO_WORDS = 'A logo you choose is made to fit and saved at once, on its own, before Save and publish. Press Save and publish while it uploads and your changes save as soon as the upload is done.'
const COLOUR_WORDS = 'The club\'s color is drawn as a band, a tint and small bars on the new club pages, never as words; a club with no color of its own shows navy.'

/** Each field and what it is for, in the form's order, then the previews. */
function sentences(own: boolean, emailHidden: boolean, pagesOn: boolean, showAdmin: boolean): Array<[string, string]> {
  // "Your club" only to the club's own rep; anyone else who keeps the club reads "the club's".
  const clubs = own ? 'your club\'s' : 'the club\'s'
  const page = own ? 'your page' : 'the club\'s page'
  const where =
    'The place the club meets, its street if you know it, and a note such as the room. Set the pin by clicking the map or dragging the pin, or paste coordinates or a Google Maps link; nothing is looked up for you. If the club meets in two places, Add another place; a place you empty, or Remove place 2, comes off the page at the next save.'
  return [
    [
      'One sentence about the club',
      `It is shown as About on ${clubs} page and at the start of search results. You may write more, the club in its own words, up to 2,000 characters: the count under the box says how many you have used. A search result shows the start of About and then How the club meets, in words, about 155 characters in all. Keep that box short so both fit.`,
    ],
    [
      'How the club meets, in words',
      'The days, the time and the place, as the club says them, such as "First and third Tuesdays at 7:00 PM". The page shows them as words and never turns them into dates.',
    ],
    ['Where', pagesOn ? where : `${where} Today's club page shows the place's name, its street and its pin; the note shows once the new club pages open.`],
    pagesOn
      ? ['Contact name shown on the page', `The name visitors see beside Contact on ${clubs} page.`]
      : ['Contact name', `The name visitors will see beside Contact on ${clubs} page once the new club pages open. Today's club page does not show it.`],
    [
      'Email for messages',
      emailHidden
        ? `It is never shown on ${clubs} page or to visitors.`
        : 'Today\'s club page shows this address to visitors.',
    ],
    [
      'Name and address',
      `${pagesOn
        ? `The city makes the line under ${clubs} name, such as "Chess club in Baton Rouge, Louisiana", on ${page} and in search results, and helps people who search for a chess club near it.`
        : `Today's club page shows the city under ${clubs} name, such as "Baton Rouge, LA", and a shared link to the page starts with a line such as "Chess club in Baton Rouge, Louisiana", which search results may show too. The city also helps people who search for a chess club near it. That line goes under the name once the new club pages open.`
      } ${pagesOn
        ? `${own ? 'Your page\'s address' : 'The address of the club\'s page'} is made from the club's name the first time the page is saved, and stays the same if the club is renamed, so links and search results keep working.`
        : `Today's club page keeps the address shown under "${addressCardName(own)}", which stays the same if the club is renamed, so links and search results keep working.`
      }${showAdmin ? '' : ' The name, the region and the address are kept by LCA admins: ask LCA if one ever needs to change.'}`,
    ],
    ...(showAdmin
      ? [[
          'Club name, region and page address',
          pagesOn
            ? 'Only LCA admins change these. The page address is the part after /clubs/ in the club page\'s address; when it changes, the old address keeps working.'
            : 'Only LCA admins change these. The page address is used once the new club pages open; today\'s club page keeps its own address, which does not change.',
        ] as [string, string]]
      : []),
    [
      'Cost and who is welcome',
      `Cost is what a club night costs, such as "Free" or "$5 toward the room". Who is welcome says who the club is for and what a first-timer should bring or ask for. Tick The club plays on weekends or Scholastic friendly only when it is so${pagesOn
        ? '; the club directory\'s filters read them.'
        : '. Today\'s club page and directory show none of these; they show once the new club pages open, and the new directory\'s filters read the ticks.'}`,
    ],
    [
      'Links',
      `Each link is a whole web address that starts with http:// or https://, such as ${clubs} Facebook page. ${pagesOn
        ? 'Leave a box empty to show no link there.'
        : 'Today\'s club page shows none of these links; they show once the new club pages open, and a box left empty shows no link there.'}`,
    ],
    ['Logo and club color', `${LOGO_WORDS} ${COLOUR_WORDS}`],
    [
      'Today\'s page shows different words here',
      'Today\'s club page shows its own, shorter words where this listing holds the words written for the new club pages, or words changed in the older form since. Any save, even of one other field, puts this listing\'s words on today\'s page in place of today\'s, so read both before you save.',
    ],
    [
      'Save and publish',
      `${pagesOn
        ? `Your changes go live on ${clubs} page at once.`
        : 'The sentence about the club, how it meets, and the place\'s name, street and pin go live on today\'s club page at once; the contact name and the place\'s note show once the new club pages open. So do the cost, who is welcome, the two ticks and the links.'
      } When someone other than the region's representative saves, the representative is emailed what changed. Search results may take a few days to show a change.`,
    ],
    [
      'Preview',
      `Beside the form, or under Preview on a phone, you see how ${page} shows up in a search and when someone shares it, its card in LCA's club directory, and what the page has. They change as you type.${pagesOn ? '' : ' They show the new club pages as they will be once they open, not today\'s page.'} Google shows about the first 60 characters of a title, so ${clubs} name and city come first. A shared link shows ${own ? 'your logo, or your club\'s initials' : 'the club\'s logo, or its initials'} on navy when it has none.`,
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
  if (part === 'color') return [['Logo and club color', COLOUR_WORDS]]
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
