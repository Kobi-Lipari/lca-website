// src/components/uscf/UsChessMembership.tsx
//
// A player's US Chess membership at a glance, like the LCA one: valid,
// expiring soon, or expired, with a renew button. The expiry date comes
// from US Chess (checked nightly, and right away when an ID is added).
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'

import { cn } from '@/lib/utils'

export const USCHESS_RENEW_URL = 'https://new.uschess.org/join-us-chess'
const SOON_DAYS = 45

export type UsChessState = 'none' | 'unknown' | 'valid' | 'soon' | 'expired'

export function usChessState(uscfId: string | null | undefined, expiration: string | null | undefined, now = new Date()): UsChessState {
  if (!uscfId) return 'none'
  if (!expiration) return 'unknown'
  const end = new Date(`${expiration.slice(0, 10)}T23:59:59`)
  if (Number.isNaN(end.getTime())) return 'unknown'
  if (end < now) return 'expired'
  return end.getTime() - now.getTime() < SOON_DAYS * 86_400_000 ? 'soon' : 'valid'
}

const fmtDate = (d: string) => new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

const BADGE: Record<UsChessState, { label: string; className: string }> = {
  none: { label: 'No ID yet', className: 'bg-muted text-muted-foreground' },
  unknown: { label: 'Checking', className: 'bg-muted text-muted-foreground' },
  valid: { label: 'Active', className: 'bg-emerald-100 text-emerald-800' },
  soon: { label: 'Expiring soon', className: 'bg-amber-100 text-amber-900' },
  expired: { label: 'Expired', className: 'bg-red-100 text-red-800' },
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
        {state === 'valid' && <>Your US Chess membership is valid through <span className="font-medium text-lca-navy">{fmtDate(expiration as string)}</span>.</>}
        {state === 'soon' && <>Your US Chess membership expires <span className="font-medium text-lca-navy">{fmtDate(expiration as string)}</span>. Renew so your next rated games count.</>}
        {state === 'expired' && <>Your US Chess membership expired <span className="font-medium text-lca-navy">{fmtDate(expiration as string)}</span>. Renew it before your next rated event, or your games can't be rated.</>}
      </p>
      {state === 'none' ? (
        <Link to={profileHref} className="mt-4 inline-block text-sm font-medium text-lca-navy underline underline-offset-2">Add your US Chess ID</Link>
      ) : (
        <a
          href={USCHESS_RENEW_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'mt-4 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium',
            state === 'valid' || state === 'unknown'
              ? 'border text-lca-navy hover:bg-muted/50'
              : 'bg-lca-gold font-semibold text-lca-navy hover:bg-lca-gold/90',
          )}
        >
          Renew at US Chess <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  )
}
