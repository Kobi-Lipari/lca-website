// src/areas/admin/newsletter/CountCard.tsx
//
// The count card under the side preview (board Newsletter-Page-4, P9): how
// many people will get the newsletter, the count GET /api/admin/mail/newsletter
// already gives the newsletter tab (its summary's willGet, members only, as
// today). When the count cannot be read it says so in words and shows no
// number. The people a sender adds, and "Add or review people", come with
// checkpoint R.

import { Users } from 'lucide-react'

export interface CountCardProps {
  /** The count, null while it is on the way, or 'failed' when it could not be read. */
  count: number | null | 'failed'
}

/** "155 people will get it", in words for one person too. */
function countWords(count: number): string {
  return count === 1 ? '1 person will get it' : `${count.toLocaleString('en-US')} people will get it`
}

export function CountCard({ count }: CountCardProps) {
  const words = count === null ? 'Counting the people who will get it' : count === 'failed' ? 'The number of people who will get it could not be read.' : countWords(count)
  return (
    <div className="mt-3.5 rounded-xl border border-border bg-background px-4 pb-4 pt-3.5 shadow-sm" data-slot="count-card">
      <p className="flex items-start gap-2.5 text-ink">
        <Users className="mt-1 size-[18px] flex-none" aria-hidden="true" />
        <span role="status" className={count === 'failed' ? 'text-[15px] font-semibold' : 'text-[17px] font-bold leading-snug'}>
          {words}
        </span>
      </p>
    </div>
  )
}
