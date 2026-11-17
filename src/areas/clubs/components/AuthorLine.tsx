// src/areas/clubs/components/AuthorLine.tsx
//
// The new club page's author line (WS09 step 21): who keeps the page, once,
// in the words the server built ("Kept by the club's rep, Player O.", "Kept
// by LCA admins" and the like), drawn as given and never built or mended
// here. A signed-in keeper also reads where they stand, "This is your club's
// page · Edit" for the club's own rep and "You can edit this page as the
// {region} representative · Edit" for the representative whose region
// covers the club, with Edit leading to the page they keep it from. The
// page decides that from what the session already holds and draws it only
// while clubKeepers is on, since those pages exist only then. Suggest an
// update and "Is this your club? Ask to be its named rep" join this line
// with the steps that build them.
import { Link } from 'react-router-dom'

import { WORD_LINK, keeperWords, type Keeper } from '@/areas/clubs/clubPage'

export function AuthorLine({ author, keeper }: { author: string; keeper: Keeper | null }) {
  return (
    <div className="border-b border-hairline bg-surface-2">
      <div className="mx-auto flex min-h-11 max-w-6xl flex-wrap items-center gap-x-3 gap-y-0 px-4 py-1 text-sm text-ink sm:px-6">
        <p className="py-2 font-semibold">{author}</p>
        {keeper && (
          <p className="flex flex-wrap items-center gap-x-2">
            <span aria-hidden="true" className="hidden h-4 w-px bg-field @xl:inline-block" />
            <span>{keeperWords(keeper)}</span>
            <span aria-hidden="true">·</span>
            <Link to={keeper.edit} className={WORD_LINK}>Edit</Link>
          </p>
        )}
      </div>
    </div>
  )
}
