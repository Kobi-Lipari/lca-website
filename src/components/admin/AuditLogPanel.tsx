// src/components/admin/AuditLogPanel.tsx
import { useEffect, useMemo, useState } from 'react'
import { ShieldAlert, UserCog, CreditCard, Building2, Eye, EyeOff, Trophy, Globe, Trash2, Mail, UserPlus, UserMinus, DollarSign, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { adminGetAuditLog, type ApiAuditEntry } from '@/lib/api'
import { ROLE_LABELS } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { ADMIN_SCROLL } from '@/lib/brand'

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All actions' },
  { value: 'role_change', label: 'Role changes' },
  { value: 'membership_override', label: 'Membership overrides' },
  { value: 'club_change', label: 'Club changes' },
  { value: 'impersonation_start', label: 'Impersonation' },
  { value: 'tournament_create,tournament_publish,tournament_unpublish,round_paired,round_delete,pairing_edit,tournament_complete,announcement_sent,director_assign,director_remove,registration_withdraw,registration_reinstate', label: 'Events' },
  { value: 'payment_change', label: 'Payments' },
  { value: 'club_edit,officer_add,officer_remove', label: 'Club edits' },
  { value: 'group_email_sent', label: 'Group email' },
  { value: 'ticket_delete', label: 'Deleted tickets' },
]

const ACTION_META: Record<
  string,
  { label: string; icon: typeof UserCog; className: string }
> = {
  role_change: {
    label: 'Role change',
    icon: UserCog,
    // Role changes are the entries worth spotting from across the room.
    className: 'bg-red-100 text-red-800',
  },
  membership_override: {
    label: 'Membership override',
    icon: CreditCard,
    className: 'bg-lca-gold/20 text-[#7a5c00]',
  },
  club_change: {
    label: 'Club change',
    icon: Building2,
    className: 'bg-blue-100 text-blue-800',
  },
  impersonation_start: {
    label: 'Started impersonating',
    icon: Eye,
    className: 'bg-purple-100 text-purple-800',
  },
  impersonation_end: {
    label: 'Stopped impersonating',
    icon: EyeOff,
    className: 'bg-muted text-muted-foreground',
  },
  ticket_delete: { label: 'Deleted ticket', icon: Trash2, className: 'bg-red-100 text-red-800' },
  tournament_create: { label: 'Created event', icon: Trophy, className: 'bg-emerald-100 text-emerald-800' },
  tournament_publish: { label: 'Made event public', icon: Globe, className: 'bg-emerald-100 text-emerald-800' },
  tournament_unpublish: { label: 'Hid event', icon: EyeOff, className: 'bg-muted text-muted-foreground' },
  round_delete: { label: 'Deleted round', icon: Trash2, className: 'bg-red-100 text-red-800' },
  round_paired: { label: 'Paired round', icon: Trophy, className: 'bg-emerald-100 text-emerald-800' },
  pairing_edit: { label: 'Changed a pairing', icon: Pencil, className: 'bg-lca-gold/20 text-[#7a5c00]' },
  tournament_complete: { label: 'Finished event', icon: Trophy, className: 'bg-emerald-100 text-emerald-800' },
  announcement_sent: { label: 'Emailed entrants', icon: Mail, className: 'bg-blue-100 text-blue-800' },
  director_assign: { label: 'Added director', icon: UserPlus, className: 'bg-blue-100 text-blue-800' },
  director_remove: { label: 'Removed director', icon: UserMinus, className: 'bg-muted text-muted-foreground' },
  registration_withdraw: { label: 'Withdrew player', icon: UserMinus, className: 'bg-lca-gold/20 text-[#7a5c00]' },
  registration_reinstate: { label: 'Reinstated player', icon: UserPlus, className: 'bg-lca-gold/20 text-[#7a5c00]' },
  payment_change: { label: 'Payment status', icon: DollarSign, className: 'bg-lca-gold/20 text-[#7a5c00]' },
  club_edit: { label: 'Edited club', icon: Pencil, className: 'bg-blue-100 text-blue-800' },
  officer_add: { label: 'Added officer', icon: UserPlus, className: 'bg-blue-100 text-blue-800' },
  officer_remove: { label: 'Removed officer', icon: UserMinus, className: 'bg-muted text-muted-foreground' },
  group_email_sent: { label: 'Sent group email', icon: Mail, className: 'bg-blue-100 text-blue-800' },
  ticket_reply: { label: 'Answered ticket', icon: Mail, className: 'bg-muted text-muted-foreground' },
}

function roleLabel(role: unknown): string {
  if (typeof role !== 'string') return 'none'
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role
}

/** Renders the `detail` JSON as something readable per action type. */
function describeDetail(entry: ApiAuditEntry): string | null {
  if (!entry.detail) return null

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(entry.detail) as Record<string, unknown>
  } catch {
    return entry.detail
  }

  switch (entry.action) {
    case 'role_change':
      return `${roleLabel(parsed.from)} → ${roleLabel(parsed.to)}`
    case 'club_change':
      return `${parsed.from ?? 'no club'} → ${parsed.to ?? 'no club'}`
    case 'membership_override': {
      const from = parsed.from as { status?: string; expiry?: string } | undefined
      const to = parsed.to as { status?: string; expiry?: string } | undefined
      return `${from?.status ?? '—'} (${from?.expiry ?? 'no expiry'}) → ${
        to?.status ?? '—'
      } (${to?.expiry ?? 'no expiry'})`
    }
    case 'payment_change':
      return `${parsed.from ?? '—'} → ${parsed.to ?? '—'}`
    case 'director_assign':
    case 'director_remove':
      return typeof parsed.tournament === 'string' ? parsed.tournament : null
    case 'round_paired':
      return `Round ${parsed.round}${parsed.section ? `, ${parsed.section}` : ''} (${parsed.boards ?? 0} boards)`
    case 'round_delete':
      return `Round ${parsed.round}${parsed.section ? `, ${parsed.section}` : ''} (${parsed.games ?? 0} games)`
    case 'announcement_sent':
      return `"${parsed.subject ?? ''}" to ${parsed.sent ?? 0} players`
    case 'club_edit':
      return Array.isArray(parsed.fields) ? `Changed ${parsed.fields.join(', ').replace(/_/g, ' ')}` : null
    case 'officer_add':
    case 'officer_remove':
      return typeof parsed.title === 'string' ? parsed.title : null
    case 'group_email_sent':
      return `${parsed.recipients ?? 0} recipients`
    case 'ticket_delete':
      return typeof parsed.from === 'string' ? `From ${parsed.from}` : null
    default:
      return null
  }
}

export function AuditLogPanel() {
  const [entries, setEntries] = useState<ApiAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const rows = await adminGetAuditLog({
          action: filter || undefined,
          limit: 200,
        })
        if (cancelled) return
        setEntries(rows)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load audit log')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [filter])

  // A start with no matching end means the admin closed the tab rather than
  // clicking "stop impersonating". Worth surfacing, but as "unknown", not as
  // "still active" — nothing here can actually know that.
  const unclosedImpersonations = useMemo(() => {
    const ended = new Set(
      entries
        .filter((e) => e.action === 'impersonation_end')
        .map((e) => e.target_member_id),
    )
    return entries.filter(
      (e) => e.action === 'impersonation_start' && !ended.has(e.target_member_id),
    ).length
  }, [entries])

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert className="size-5 text-lca-gold" />
        <h2 className="text-xl font-bold text-lca-navy">Admin activity</h2>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Admin actions plus what club reps and directors change (events, payments,
        club pages), newest first. Role changes matter most here: that is how an
        account gains admin access, so an entry you don't recognise is worth
        asking about.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            type="button"
            size="sm"
            variant={filter === f.value ? 'default' : 'outline'}
            className={cn(filter === f.value && 'bg-lca-gold text-lca-navy hover:bg-lca-gold/90')}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {unclosedImpersonations > 0 && filter === '' && (
        <p className="mb-4 rounded-lg border border-lca-gold/40 bg-lca-gold/10 px-3 py-2 text-xs text-lca-navy">
          {unclosedImpersonations} impersonation
          {unclosedImpersonations === 1 ? '' : 's'} with no recorded end. Usually
          means the tab was closed rather than exited — the end time is unknown,
          not necessarily still running.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No admin actions recorded yet.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Logging began when this feature shipped, so earlier actions are not
            here.
          </p>
        </div>
      ) : (
        <div className={`${ADMIN_SCROLL} rounded-xl border bg-card`}>
          {entries.map((entry) => {
            const meta = ACTION_META[entry.action] ?? {
              label: entry.action,
              icon: ShieldAlert,
              className: 'bg-muted text-muted-foreground',
            }
            const Icon = meta.icon
            const detail = describeDetail(entry)

            return (
              <div
                key={entry.id}
                className="flex flex-col gap-1 border-b border-border px-4 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                        meta.className,
                      )}
                    >
                      <Icon className="size-3" /> {meta.label}
                    </span>
                    <span className="truncate text-sm text-lca-navy">
                      {entry.target_label ?? '—'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    by <span className="font-medium">{entry.actor_email}</span>
                    {detail && <> · {detail}</>}
                  </p>
                </div>
                <span className="flex-shrink-0 text-xs text-muted-foreground">
                  {new Date(`${entry.created_at.replace(' ', 'T')}Z`).toLocaleString()}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
