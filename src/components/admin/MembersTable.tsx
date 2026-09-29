// src/components/admin/MembersTable.tsx
// The member directory table. Fully editable for admins; a read-only
// lookup (name, email, membership) for everyone else who can open it.
import { useState } from 'react'
import { LogIn, Search, Trash2 } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { MemberSeatsCell } from '@/components/admin/MemberSeatsCell'
import type {
  ApiAdminBoardSeat,
  ApiAdminMember,
  ApiClubListItem,
  ApiSeatHolder,
} from '@/lib/api'
import { MEMBER_ROLES, ROLE_LABELS, type MemberRole } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { ADMIN_SCROLL } from '@/lib/brand'

// ── Members tab content (membership-focused, searchable + filterable; edit controls admin-only) ────

type MembershipFilter = 'active' | 'all'

/**
 * Inline name editor for the members table.
 *
 * Commits on blur or Enter rather than on every keystroke — the other cells
 * here are selects and date pickers where a change event is a whole edit, but
 * a text field would otherwise fire a request per character. Escape abandons
 * the edit and restores what was there.
 */
function NameCell({
  value,
  disabled,
  onSave,
}: {
  value: string
  disabled: boolean
  onSave: (next: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState(value)
  const [lastSaved, setLastSaved] = useState(value)

  // Follow the row when the stored name changes underneath us, e.g. after the
  // member list is refetched. Adjusting during render rather than in an effect
  // avoids a frame showing the stale draft.
  if (value !== lastSaved) {
    setLastSaved(value)
    setDraft(value)
  }

  const commit = async () => {
    const next = draft.trim()
    if (!next || next === value) {
      setDraft(value)
      return
    }
    const saved = await onSave(next)
    if (!saved) setDraft(value)
  }

  return (
    <Input
      className="h-8 w-[200px] text-sm"
      value={draft}
      disabled={disabled}
      aria-label={`Name for ${value}`}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        } else if (e.key === 'Escape') {
          setDraft(value)
          e.currentTarget.blur()
        }
      }}
    />
  )
}

/** Edit handlers — required when isAdmin, unused in the read-only lookup. */
export interface MembersTableAdminProps {
  clubs: ApiClubListItem[]
  savingId: string | null
  boardSeats: ApiAdminBoardSeat[]
  seatHolders: ApiSeatHolder[]
  onRoleChange: (memberId: string, role: MemberRole) => void
  onClubChange: (memberId: string, clubId: string) => void
  onMembershipChange: (memberId: string, field: 'status' | 'expiry', value: string) => void
  onNameChange: (memberId: string, fullName: string) => Promise<boolean>
  onDelete: (m: ApiAdminMember) => void
  onImpersonate: (m: ApiAdminMember) => void
  onSeatAdd: (seatId: string, memberId: string) => void
  onSeatRemove: (seatId: string, memberId: string) => void
}

export function MembersTable({ members, admin }: {
  members: ApiAdminMember[]
  /** Pass to get the editable admin table; omit for a read-only lookup. */
  admin?: MembersTableAdminProps
}) {
  const isAdmin = !!admin
  const [filter, setFilter] = useState<MembershipFilter>('active')
  const [search, setSearch] = useState('')

  // Search matches name, email, or USCF ID (case-insensitive substring).
  // When a search is typed, it looks across ALL members regardless of the
  // active/all toggle — so "is this person in the system?" always gets a
  // truthful answer, with the status badge/select showing whether they're
  // active. With no search, the toggle behaves as before.
  const query = search.trim().toLowerCase()
  const matches = (m: ApiAdminMember) => {
    if (!query) return true
    const uscf = m.uscf_id ?? ''
    return (
      m.full_name.toLowerCase().includes(query) ||
      m.email.toLowerCase().includes(query) ||
      uscf.toLowerCase().includes(query)
    )
  }
  const filtered = query
    ? members.filter(matches)
    : filter === 'active'
      ? members.filter((m) => m.membership_status === 'active')
      : members

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-800',
      expired: 'bg-destructive/10 text-destructive',
      pending: 'bg-lca-gold/15 text-[#7a5c00]',
    }
    return map[status] ?? 'bg-muted text-muted-foreground'
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Members{' '}
          {query
            ? `· ${filtered.length} match${filtered.length !== 1 ? 'es' : ''} of ${members.length}`
            : filter === 'active' ? `· ${filtered.length} active` : `· ${filtered.length} total`}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search name, email, USCF ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-56 pl-8 text-sm"
            />
          </div>
          <div className={cn('flex gap-1.5 rounded-lg border p-1', query && 'opacity-50')}>
            {(['active', 'all'] as MembershipFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                disabled={!!query}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                  filter === f ? 'bg-lca-navy text-white' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f === 'active' ? 'Active only' : 'All members'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`${ADMIN_SCROLL} rounded-xl border`}>
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="border-b bg-muted">
              <th className="px-3 py-2.5 font-semibold">Name</th>
              <th className="px-3 py-2.5 font-semibold">Email</th>
              <th className="px-3 py-2.5 font-semibold">Membership</th>
              <th className="px-3 py-2.5 font-semibold">Expires</th>
              {isAdmin && <th className="px-3 py-2.5 font-semibold">Role</th>}
              {isAdmin && <th className="px-3 py-2.5 font-semibold">Club</th>}
              {isAdmin && <th className="px-3 py-2.5 font-semibold">Board seats</th>}
              {isAdmin && <th className="w-10 px-3 py-2.5" />}
              {isAdmin && <th className="w-10 px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 9 : 4} className="px-3 py-8 text-center text-muted-foreground">
                  {query
                    ? <>No members match "{search.trim()}".</>
                    : filter === 'active' ? 'No active members found.' : 'No members found.'}
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-3 py-2.5 font-medium">
                    {isAdmin ? (
                      <NameCell
                        value={m.full_name}
                        disabled={admin!.savingId === m.id}
                        onSave={(next) => admin!.onNameChange(m.id, next)}
                      />
                    ) : (
                      m.full_name
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{m.email}</td>
                  <td className="px-3 py-2.5">
                    {isAdmin ? (
                      <select
                        className="rounded-md border bg-background px-2 py-1 text-xs"
                        value={m.membership_status}
                        disabled={admin!.savingId === m.id}
                        onChange={(e) => admin!.onMembershipChange(m.id, 'status', e.target.value)}
                      >
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                        <option value="pending">Pending</option>
                      </select>
                    ) : (
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium capitalize', statusBadge(m.membership_status))}>
                        {m.membership_status}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {isAdmin ? (
                      <Input
                        type="date"
                        className="h-8 w-[140px] text-xs"
                        value={m.membership_expiry ?? ''}
                        disabled={admin!.savingId === m.id}
                        onChange={(e) => admin!.onMembershipChange(m.id, 'expiry', e.target.value)}
                      />
                    ) : (
                      <span className="text-muted-foreground">{m.membership_expiry ?? '—'}</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      <select
                        className="rounded-md border bg-background px-2 py-1 text-sm"
                        value={m.role}
                        disabled={admin!.savingId === m.id}
                        onChange={(e) => admin!.onRoleChange(m.id, e.target.value as MemberRole)}
                      >
                        {MEMBER_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      <select
                        className="max-w-[180px] rounded-md border bg-background px-2 py-1 text-sm"
                        value={m.club_id ?? ''}
                        disabled={admin!.savingId === m.id}
                        onChange={(e) => admin!.onClubChange(m.id, e.target.value)}
                      >
                        <option value="">No club</option>
                        {admin!.clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      <MemberSeatsCell
                        member={m}
                        seats={admin!.boardSeats}
                        holders={admin!.seatHolders}
                        busy={admin!.savingId === m.id}
                        onAdd={admin!.onSeatAdd}
                        onRemove={admin!.onSeatRemove}
                      />
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => admin!.onImpersonate(m)}
                        disabled={m.role === 'lca_admin'}
                        className="text-muted-foreground transition-colors hover:text-lca-navy disabled:cursor-not-allowed disabled:opacity-30"
                        title={m.role === 'lca_admin' ? "Can't log in as another admin" : 'Log in as this member'}
                      >
                        <LogIn className="size-4" />
                      </button>
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => admin!.onDelete(m)} className="text-muted-foreground transition-colors hover:text-destructive" title="Delete member">
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
