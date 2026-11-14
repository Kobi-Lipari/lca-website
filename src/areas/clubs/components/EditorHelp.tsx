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
// The email's sentence follows clubEmailHidden, as the field's label does:
// only while that switch is on does Help say the address is never shown.
// The contact name's, the note's and Save and publish's sentences follow the
// new club pages (clubPagesOn) the same way: today's club page shows neither
// the contact name nor the place's note, so until those pages are on Help
// says what goes live on today's page at once and what shows once they open.
import type { KeyboardEvent, Ref } from 'react'
import { CircleHelp } from 'lucide-react'

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

/** Each basic and what it is for, in the form's order. */
function sentences(emailHidden: boolean, pagesOn: boolean, showAdmin: boolean): Array<[string, string]> {
  const where =
    'The place the club meets, its street if you know it, and a note such as the room. Set the pin by clicking the map or dragging the pin, or paste coordinates or a Google Maps link; nothing is looked up for you. The city and the region come from LCA\'s club list.'
  return [
    ['One sentence about the club', 'It is shown as About on your club\'s page and at the start of search results.'],
    [
      'How the club meets, in words',
      'The days, the time and the place, as the club says them, such as "First and third Tuesdays at 7:00 PM". The page shows them as words and never turns them into dates.',
    ],
    ['Where', pagesOn ? where : `${where} Today's club page shows the place's name, its street and its pin; the note shows once the new club pages open.`],
    pagesOn
      ? ['Contact name shown on the page', 'The name visitors see beside Contact on your club\'s page.']
      : ['Contact name', 'The name visitors will see beside Contact on your club\'s page once the new club pages open. Today\'s club page does not show it.'],
    [
      'Email for messages',
      emailHidden
        ? 'It is never shown on your club\'s page or to visitors.'
        : 'Today\'s club page shows this address to visitors.',
    ],
    ...(showAdmin
      ? [[
          'Club name, region and page address',
          'Only LCA admins change these. The page address is the part after /clubs/ in the club page\'s address; when it changes, the old address keeps working.',
        ] as [string, string]]
      : []),
    [
      'Today\'s page shows different words here',
      'Your club\'s page as it stands shows other words than this listing holds, because they were changed in the older form. Save and publish puts this listing\'s words on the page.',
    ],
    [
      'Save and publish',
      `${pagesOn
        ? 'Your changes go live on your club\'s page at once.'
        : 'The sentence about the club, how it meets, and the place\'s name, street and pin go live on today\'s club page at once; the contact name and the place\'s note show once the new club pages open.'
      } When someone other than the region's representative saves, the representative is emailed what changed. Search results may take a few days to show a change.`,
    ],
  ]
}

export function EditorHelp({
  open, emailHidden, pagesOn, showAdmin, onClose, ref,
}: {
  open: boolean
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
      className="space-y-3 rounded-lg border border-hairline bg-card p-4 text-sm text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
    >
      <h3 id={`${HELP_ID}-title`} className="text-base font-semibold">Help</h3>
      <dl className="space-y-3">
        {sentences(emailHidden, pagesOn, showAdmin).map(([term, text]) => (
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
