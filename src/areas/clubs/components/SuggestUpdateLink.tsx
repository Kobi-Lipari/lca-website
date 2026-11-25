// src/areas/clubs/components/SuggestUpdateLink.tsx
//
// The two ways into Suggest an update on a club's page (WS09 step 28): a
// link-styled button, "Suggest an update", drawn at the end of the "Last
// checked" line in When and where and beside Contact's heading, and nowhere
// else on the page, never on each block. The page keeps which of the two
// opened the sheet, and the sheet itself (SuggestUpdateSheet.tsx) is fetched
// only the first time a person opens it, so the page's own file carries
// nothing of it but these few lines.
import { lazy, Suspense } from 'react'

import { cn } from '@/lib/utils'
import { WORD_LINK } from '@/areas/clubs/clubPage'
import { SUGGEST_LINK, type SuggestionGoesTo } from '@domain/clubs/suggestion'

const SuggestUpdateSheet = lazy(() => import('@/areas/clubs/components/SuggestUpdateSheet').then((m) => ({ default: m.SuggestUpdateSheet })))

/** One way into the sheet; it hands the page the button pressed, so the focus can go back to it. */
export function SuggestUpdateLink({ onOpen, className }: { onOpen: (from: HTMLElement) => void; className?: string }) {
  return (
    <button
      type="button"
      data-slot="suggest-update-link"
      aria-haspopup="dialog"
      onClick={(e) => onOpen(e.currentTarget)}
      className={cn(WORD_LINK, 'text-sm', className)}
    >
      {SUGGEST_LINK}
    </button>
  )
}

/** The sheet, drawn only while it is open; the first open fetches its file. */
export function SuggestUpdateHost({
  from, onClose, clubName, address, goesTo, region,
}: {
  /** The button that opened the sheet, or null while it is shut. */
  from: HTMLElement | null
  onClose: () => void
  clubName: string
  address: string
  goesTo: SuggestionGoesTo
  region: string | null
}) {
  if (!from) return null
  return (
    <Suspense fallback={null}>
      <SuggestUpdateSheet open onClose={onClose} clubName={clubName} address={address} goesTo={goesTo} region={region} />
    </Suspense>
  )
}
