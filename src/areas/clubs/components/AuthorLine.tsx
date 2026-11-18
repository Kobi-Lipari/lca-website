// src/areas/clubs/components/AuthorLine.tsx
//
// The band under the new club page's cover (WS09 step 21), drawn only for a
// signed-in keeper of the club, who reads where they stand: "This is your
// club's page · Edit" for the club's own rep and "You can edit this page as
// the {region} representative · Edit" for the representative whose region
// covers the club, with Edit leading to the page they keep it from. The
// page decides that from what the session already holds and draws it only
// while clubKeepers is on, since those pages exist only then. Who keeps a
// club is not shown to anyone else (K's decision 12), so with no keeper
// there is no band at all and the page draws nothing in its place.
import { Link } from 'react-router-dom'

import { WORD_LINK, keeperWords, type Keeper } from '@/areas/clubs/clubPage'

export function AuthorLine({ keeper }: { keeper: Keeper }) {
  return (
    <div className="border-b border-hairline bg-surface-2">
      <div className="mx-auto flex min-h-11 max-w-6xl flex-wrap items-center gap-x-3 gap-y-0 px-4 py-1 text-sm text-ink sm:px-6">
        <p className="flex flex-wrap items-center gap-x-2">
          <span>{keeperWords(keeper)}</span>
          <span aria-hidden="true">·</span>
          <Link to={keeper.edit} className={WORD_LINK}>Edit</Link>
        </p>
      </div>
    </div>
  )
}
