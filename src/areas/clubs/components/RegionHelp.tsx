// src/areas/clubs/components/RegionHelp.tsx
//
// Help for My region (WS09 step 11): its button and the part it opens, which
// holds every sentence that explains the page, so none sits beside a
// control. As the editor's Help does (EditorHelp.tsx), it opens by itself
// once, the first time a person opens the page (src/areas/clubs/region.ts
// keeps that under its own key), the focus moves into it when it opens, and
// Escape or Close help shuts it with the focus back on the button.
//
// It says only what is true with clubKeepers on today: what Still accurate
// and Confirm all do, what the 90 days mean and where the stamps show, and
// that the bar names the day the next monthly check is due. It names no
// hour and says nothing of what the monthly check does or sends, since
// nothing runs it until a later step. An LCA admin never reads "your
// region".
import type { KeyboardEvent, Ref } from 'react'
import { CircleHelp } from 'lucide-react'

import { REGION_HELP_ID } from '@/areas/clubs/region'

/**
 * A button of Help: 44px tall, a visible ring on focus, its words 14px, as
 * the editor's Help button is. The editor's own file is loaded only with the
 * editor's chunk, so this page draws its own.
 */
const OPENER =
  'inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-focus'

export function RegionHelpButton({ open, onToggle, ref }: { open: boolean; onToggle: () => void; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button ref={ref} type="button" className={OPENER} aria-expanded={open} aria-controls={REGION_HELP_ID} onClick={onToggle}>
      <CircleHelp className="size-4" aria-hidden="true" /> Help
    </button>
  )
}

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

export function RegionHelp({ open, isAdmin, onClose, ref }: {
  open: boolean
  isAdmin: boolean
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
      id={REGION_HELP_ID}
      data-slot="region-help"
      hidden={!open}
      tabIndex={-1}
      aria-labelledby={`${REGION_HELP_ID}-title`}
      onKeyDown={onKeyDown}
      className="scroll-mt-24 space-y-3 rounded-lg border border-hairline bg-card p-4 text-sm text-ink outline-none focus-visible:ring-3 focus-visible:ring-focus"
    >
      <h2 id={`${REGION_HELP_ID}-title`} className="text-base font-semibold">Help</h2>
      <dl className="space-y-3">
        {sentences(isAdmin).map(([term, text]) => (
          <div key={term}>
            <dt className="font-medium">{term}</dt>
            <dd className="break-words text-muted-foreground">{text}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className={OPENER} onClick={onClose}>Close help</button>
    </section>
  )
}
