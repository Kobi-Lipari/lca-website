// src/areas/clubs/components/ClubFootLine.tsx
//
// The new club page's foot line (WS09 step 22), the page's last line before
// the site's footer: "{Club} · {city}, Louisiana · a club listed by the
// Louisiana Chess Association · {address}", where the address is the page's
// own, as Share gives it, with no query and no hash, and Copy link, which
// copies it. What Copy link did is said in the page's one status, under the
// cover's buttons, which a screen reader hears; the same words show beside
// the button for the eye, hidden from a screen reader so they are heard
// once. Nothing is sent anywhere.
import { Copy } from 'lucide-react'

import { cn } from '@/lib/utils'
import { CONTROL, type Said } from '@/areas/clubs/clubPage'
import { footPlace } from '@/areas/clubs/clubPageRows'

export function ClubFootLine({
  name, city, address, said, onCopy,
}: {
  name: string
  city: string
  /** The page's own address in full. */
  address: string
  /** What the page's status says now. */
  said: Said
  onCopy: () => void
}) {
  const echo = said.from === 'foot' ? said.words : ''
  return (
    <div data-slot="club-foot" className="border-t border-hairline bg-surface-2">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-6">
        <p className="min-w-0 flex-1 break-words text-sm text-ink">
          <strong className="font-semibold">{name}</strong>
          {' · '}
          {footPlace(city)}
          {' · a club listed by the Louisiana Chess Association · '}
          <span className="break-all">{address}</span>
        </p>
        <button type="button" onClick={onCopy} className={cn(CONTROL, 'border border-field bg-surface text-ink hover:bg-surface-2')}>
          <Copy aria-hidden="true" className="size-4" />
          Copy link
        </button>
        {echo && <p aria-hidden="true" data-slot="club-foot-said" className="w-full break-words text-sm text-ink">{echo}</p>}
      </div>
    </div>
  )
}
