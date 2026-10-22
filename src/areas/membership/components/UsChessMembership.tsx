// src/areas/membership/components/UsChessMembership.tsx
//
// A player's US Chess membership at a glance, like the LCA one: valid,
// expiring soon, or expired, with a renew button. The expiry date comes
// from US Chess (checked nightly, and right away when an ID is added).
// Which of those a player is in is worked out by usChessState, in
// src/areas/membership/usChess.ts.
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

import { cn } from '@/lib/utils'
import { usChessState, type UsChessState } from '@/areas/membership/usChess'

/** US Chess sign-in, which lands on their membership renewal form. */
export const USCHESS_RENEW_URL = 'https://new.uschess.org/user/login?destination=/form/membership'

const fmtDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

const BADGE: Record<UsChessState, { label: string; className: string }> = {
  none: { label: 'No ID yet', className: 'bg-muted text-muted-foreground' },
  unknown: { label: 'Checking', className: 'bg-muted text-muted-foreground' },
  valid: { label: 'Active', className: 'bg-ok-100 text-ok' },
  soon: { label: 'Expiring soon', className: 'bg-warn-100 text-warn-900' },
  expired: { label: 'Expired', className: 'bg-bad-100 text-bad-800' },
}

export function UsChessBadge({ state }: { state: UsChessState }) {
  const b = BADGE[state]
  return <span className={cn('w-fit rounded-full px-2.5 py-0.5 text-xs font-medium', b.className)}>{b.label}</span>
}

/** The sentence and button for the dashboard card. */
export function UsChessMembershipDetail({ uscfId, expiration, profileHref = '#profile' }: {
  uscfId: string | null | undefined
  expiration: string | null | undefined
  profileHref?: string
}) {
  const state = usChessState(uscfId, expiration)
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        {state === 'none' && <>Add your US Chess ID to your profile to play in rated events and see your membership here.</>}
        {state === 'unknown' && <>US Chess ID {uscfId}. We check membership dates with US Chess nightly; yours will show here soon.</>}
        {state === 'valid' && <>Your US Chess membership is valid through <span className="font-medium text-ink">{fmtDate(expiration as string)}</span>.</>}
        {state === 'soon' && <>Your US Chess membership expires <span className="font-medium text-ink">{fmtDate(expiration as string)}</span>. Renew so your next rated games count.</>}
        {state === 'expired' && <>Your US Chess membership expired <span className="font-medium text-ink">{fmtDate(expiration as string)}</span>. Renew it before your next rated event, or your games can't be rated.</>}
      </p>
      {state === 'none' ? (
        <Link to={profileHref} className="mt-4 inline-block text-sm font-medium text-ink underline underline-offset-2">Add your US Chess ID</Link>
      ) : (
        <a
          href={USCHESS_RENEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'mt-4 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium',
            state === 'valid' || state === 'unknown'
              ? 'border text-ink hover:bg-muted/50'
              : 'bg-lca-gold font-semibold text-brand-navy hover:bg-lca-gold/90',
          )}
        >
          Renew at US Chess <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  )
}
