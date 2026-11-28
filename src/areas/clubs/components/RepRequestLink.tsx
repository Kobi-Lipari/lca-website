// src/areas/clubs/components/RepRequestLink.tsx
//
// The way into Ask to be its named rep on a club's page (WS09 step 31): one
// quiet line of its own near the page's foot, "Is this your club? Ask to be
// its named rep", the second half a link-styled button. The page draws it
// only with clubPagesOn() and only while the page's answer says the club has
// no named rep (rep_wanted); it never says who keeps the club. The sheet
// itself (RepRequestSheet.tsx) is fetched only the first time a person opens
// it, so the page's own file carries nothing of it but these few lines.
import { lazy, Suspense } from 'react'

import { cn } from '@/lib/utils'
import { WORD_LINK } from '@/areas/clubs/clubPage'
import { REP_INVITE_LEAD, REP_INVITE_LINK } from '@domain/clubs/repRequest'

const RepRequestSheet = lazy(() => import('@/areas/clubs/components/RepRequestSheet').then((m) => ({ default: m.RepRequestSheet })))

/** The invitation's line; it hands the page the button pressed, so the focus can go back to it. */
export function RepRequestLink({ onOpen }: { onOpen: (from: HTMLElement) => void }) {
  return (
    <div data-slot="rep-request-invite" className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-ink">
        <span>{REP_INVITE_LEAD}</span>{' '}
        <button type="button" aria-haspopup="dialog" onClick={(e) => onOpen(e.currentTarget)} className={cn(WORD_LINK, 'text-sm')}>
          {REP_INVITE_LINK}
        </button>
      </p>
    </div>
  )
}

/** The sheet, drawn only while it is open; the first open fetches its file. */
export function RepRequestHost({ from, onClose, clubName, address }: {
  /** The button that opened the sheet, or null while it is shut. */
  from: HTMLElement | null
  onClose: () => void
  clubName: string
  /** The club's address part: its slug, or its id while it has none. */
  address: string
}) {
  if (!from) return null
  return (
    <Suspense fallback={null}>
      <RepRequestSheet open onClose={onClose} clubName={clubName} address={address} />
    </Suspense>
  )
}
