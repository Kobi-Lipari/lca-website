// src/areas/clubs/components/EditorHelp.tsx
//
// Help for the one club editor: the button that opens and closes it, and the
// part it opens, which holds every explaining sentence the editor's boards
// print beside its fields. K's rule: explaining words sit behind Help, never
// beside a control, and Help opens by itself once, the first time a person
// uses the page (ClubEditor.tsx remembers that in the browser). When it
// opens the focus moves into it; Escape or Close help shuts it and the focus
// goes back to the button.
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
// LCA admin, reads "the club's".
import type { KeyboardEvent, Ref } from 'react'
import { CircleHelp } from 'lucide-react'

import { addressCardName } from '@/areas/clubs/editor'

/** The id of the part Help opens, which its button controls. */
const HELP_ID = 'club-editor-help'

/** A button of Help: 44px tall, a visible ring on focus, its words 14px. */
const OPENER =
  'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus'

export function EditorHelpButton({ open, onToggle, ref }: { open: boolean; onToggle: () => void; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button ref={ref} type="button" className={OPENER} aria-expanded={open} aria-controls={HELP_ID} onClick={onToggle}>
      <CircleHelp className="size-4" aria-hidden="true" /> Help
    </button>
  )
}

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
    [
      'Logo and club color',
      'A logo you choose is made to fit and saved at once, on its own, before Save and publish. Press Save and publish while it uploads and your changes save as soon as the upload is done. The club\'s color is drawn as a band, a tint and small bars on the new club pages, never as words; a club with no color of its own shows navy.',
    ],
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

export function EditorHelp({
  open, own, emailHidden, pagesOn, showAdmin, onClose, ref,
}: {
  open: boolean
  /** The club is the reader's own, as for its rep: only then does Help speak of "your club". */
  own: boolean
  emailHidden: boolean
  /** The new club pages are on (clubPagesOn), which show the contact name and the place's note. */
  pagesOn: boolean
  showAdmin: boolean
  onClose: () => void
  ref?: Ref<HTMLElement>
}) {
  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    onClose()
  }
  return (
    <section
      ref={ref}
      id={HELP_ID}
      data-slot="editor-help"
      hidden={!open}
      tabIndex={-1}
      aria-labelledby={`${HELP_ID}-title`}
      onKeyDown={onKeyDown}
      className="scroll-mt-24 space-y-3 rounded-lg border border-hairline bg-card p-4 text-sm text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
    >
      <h3 id={`${HELP_ID}-title`} className="text-base font-semibold">Help</h3>
      <dl className="space-y-3">
        {sentences(own, emailHidden, pagesOn, showAdmin).map(([term, text]) => (
          <div key={term}>
            <dt className="font-medium">{term}</dt>
            <dd className="text-muted-foreground">{text}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className={OPENER} onClick={onClose}>Close help</button>
    </section>
  )
}
