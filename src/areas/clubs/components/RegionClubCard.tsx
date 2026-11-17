// src/areas/clubs/components/RegionClubCard.tsx
//
// One club's card in My region (WS09 step 11), as the board Work-H draws it:
// the club's colour band, its logo or its initials, its name as the card's
// heading, its town and region, how it meets in its own words in two lines
// or "Schedule not listed", the stamp of its last check in words, and Still
// accurate and Open. The stamp's words come from the server as they are
// ("Checked Nov 2026", "Not checked since Aug 2026", "Not checked yet"), so
// the card makes no date. A club that needs a check has its stamp on the
// amber tint, beside its words and never in place of them. The club's own
// colour is the band alone, never words; a club with no colour of its own,
// brand gold being the database's default, shows navy.
//
// Each button is named with its club ("Still accurate: Example Chess Club")
// so a list of the page's buttons tells the cards apart. While a confirm is
// on the way Still accurate is marked busy rather than disabled, so the
// focus stays on it; a confirm that failed says so in words on the card.
// Open goes to the club's page in My region by the club's id (WS09 step 12).
import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { LCA } from '@/lib/brand'
import { initialsOf } from '@/areas/clubs/region'
import type { RegionClub } from '@domain/contracts'

/** A control on the card: 44px tall, a visible ring on focus. */
const CONTROL = 'min-h-11 px-4 whitespace-normal'

/** The stamp: on the amber tint when the club needs a check, its words dark on it at 8.73:1; otherwise plain. */
const STAMP_DUE = 'border border-warn-300 bg-warn-50 text-warn-900'
const STAMP_DONE = 'border border-hairline text-ink'

/**
 * The band's colour: the club's own, or navy for a club with none. Brand gold
 * is the database's default for every club, so a club still on it has no
 * colour of its own and shows navy, as previews.ts's ownColour reads it.
 */
function bandOf(color: string | null): string {
  const own = color?.trim().toLowerCase()
  return own && own !== LCA.gold ? own : LCA.navy
}

export function RegionClubCard({ club, busy, error, onConfirm }: {
  club: RegionClub
  /** A confirm for this club is on the way. */
  busy: boolean
  /** Why the last confirm for this club failed, in words, or null. */
  error: string | null
  onConfirm: (club: RegionClub) => void
}) {
  const nameId = `region-club-${club.id}`
  const statement = club.statement?.trim() ?? ''
  return (
    <article aria-labelledby={nameId} className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm">
      <div aria-hidden="true" className="h-2" style={{ backgroundColor: bandOf(club.color) }} />
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="flex min-w-0 items-start gap-3">
          {club.logoUrl ? (
            <img src={club.logoUrl} alt="" className="size-12 flex-shrink-0 rounded-md border border-hairline object-contain" />
          ) : (
            <span aria-hidden="true" className="flex size-12 flex-shrink-0 items-center justify-center rounded-md bg-brand-navy text-sm font-bold tracking-wide text-white">
              {initialsOf(club.name)}
            </span>
          )}
          <div className="min-w-0">
            <h3 id={nameId} className="break-words text-base font-semibold text-ink">{club.name}</h3>
            <p className="break-words text-sm text-muted-foreground">{club.region ? `${club.city} · ${club.region}` : club.city}</p>
          </div>
        </div>
        <p className="line-clamp-2 break-words text-sm text-ink">{statement ? `"${statement}"` : 'Schedule not listed'}</p>
        <p className="mt-auto">
          <span data-slot="region-stamp" className={`inline-block rounded-md px-2 py-1 text-sm font-medium ${club.needsCheck ? STAMP_DUE : STAMP_DONE}`}>
            {club.lastCheckWords}
          </span>
        </p>
        {error && <p className="break-words text-sm font-medium text-ink">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className={CONTROL}
            aria-label={`Still accurate: ${club.name}`}
            aria-disabled={busy || undefined}
            onClick={() => { if (!busy) onConfirm(club) }}
          >
            Still accurate
          </Button>
          <Button asChild variant="outline" className={CONTROL}>
            <Link to={`/workspace/region/clubs/${encodeURIComponent(club.id)}`} aria-label={`Open: ${club.name}`}>Open</Link>
          </Button>
        </div>
      </div>
    </article>
  )
}
