// src/components/admin/BoardSeatsPanel.tsx
//
// Drop this into AdminPage as its own tab. It is the only place a seat's
// holders change; the governance board editor still owns the seat's role name
// and sort order.

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, History, UserMinus, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  adminAssignBoardSeat,
  adminGetBoardSeats,
  adminGetMembers,
  adminRemoveBoardSeatHolder,
  type ApiAdminBoardSeat,
  type ApiAdminMember,
  type ApiSeatAssignment,
  type ApiSeatHolder,
} from '@/lib/api'

function formatDate(value: string | null): string {
  if (!value) return 'present'
  const d = new Date(value.replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString()
}

function SeatRow({
  seat, holders, history, members, busy, onAssign, onRemove, onVacate,
}: {
  seat: ApiAdminBoardSeat
  holders: ApiSeatHolder[]
  history: ApiSeatAssignment[]
  members: ApiAdminMember[]
  busy: boolean
  onAssign: (seatId: string, memberId: string) => void
  onRemove: (seatId: string, memberId: string) => void
  onVacate: (seatId: string) => void
}) {
  const [picking, setPicking] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [query, setQuery] = useState('')

  const heldIds = new Set(holders.map((h) => h.member_id))

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return [] as ApiAdminMember[]
    return members
      .filter(
        (m) =>
          !heldIds.has(m.id) &&
          (m.full_name.toLowerCase().includes(q) ||
            m.email.toLowerCase().includes(q)),
      )
      .slice(0, 6)
  }, [query, members, holders])

  // On a shared seat, adding never evicts — so the button says what it does.
  const addLabel = seat.is_shared
    ? 'Add holder'
    : holders.length > 0
      ? 'Replace'
      : 'Assign'

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1a2744]">
            {seat.role}
            {seat.is_shared === 1 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded bg-[#c8a94a]/15 px-1.5 py-0.5 text-[10px] font-normal text-[#7a5c00]">
                <Users className="size-2.5" /> shared
              </span>
            )}
            {!seat.is_active && (
              <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                retired
              </span>
            )}
          </p>

          {holders.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {holders.map((h) => (
                <li key={h.assignment_id} className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-[#1a2744]">{h.member_name}</span>
                  <span className="text-xs text-muted-foreground">
                    since {formatDate(h.started_at)}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onRemove(seat.id, h.member_id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Remove ${h.member_name} from ${seat.role}`}
                  >
                    <UserMinus className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm italic text-muted-foreground">
              No account linked — messages go to the LCA inbox
            </p>
          )}

          <p className="mt-1.5 text-xs text-muted-foreground">
            {seat.ticket_count} {seat.ticket_count === 1 ? 'message' : 'messages'} on file · /contact?to={seat.slug}
          </p>
        </div>

        <div className="flex flex-shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setPicking((p) => !p)}>
            <UserPlus className="mr-1.5 size-3.5" /> {addLabel}
          </Button>
          {holders.length > 1 && (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => onVacate(seat.id)}>
              Vacate all
            </Button>
          )}
        </div>
      </div>

      {picking && (
        <div className="mt-3 rounded-lg border bg-muted/30 p-3">
          <Input
            className="h-8 text-sm"
            autoFocus
            placeholder="Search members by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim() && matches.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              No match. They need a member account before they can hold a seat.
            </p>
          )}
          <div className="mt-2 space-y-1">
            {matches.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  onAssign(seat.id, m.id)
                  setPicking(false)
                  setQuery('')
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-background"
              >
                <span className="font-medium text-[#1a2744]">{m.full_name}</span>
                <span className="text-xs text-muted-foreground">{m.email}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            {seat.is_shared === 1
              ? 'This seat can be held by several people at once — adding someone leaves the current holders in place.'
              : 'Assigning replaces the current holder. They keep their account, ratings and registrations; they just stop seeing this inbox.'}
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <History className="size-3" />
            {history.length} {history.length === 1 ? 'term' : 'terms'} on record
            <ChevronDown className={`size-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1 border-l-2 border-muted pl-3 text-xs text-muted-foreground">
              {history.map((h) => (
                <li key={h.id}>
                  <span className="font-medium text-foreground">{h.member_name ?? 'Unknown'}</span>
                  {' · '}
                  {formatDate(h.started_at)} – {formatDate(h.ended_at)}
                  {h.note && <span className="italic"> — {h.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function BoardSeatsPanel() {
  const [seats, setSeats] = useState<ApiAdminBoardSeat[]>([])
  const [holders, setHolders] = useState<ApiSeatHolder[]>([])
  const [history, setHistory] = useState<ApiSeatAssignment[]>([])
  const [members, setMembers] = useState<ApiAdminMember[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const [seatData, memberList] = await Promise.all([
      adminGetBoardSeats(),
      adminGetMembers(),
    ])
    setSeats(seatData.seats)
    setHolders(seatData.holders)
    setHistory(seatData.history)
    setMembers(memberList)
  }

  useEffect(() => {
    load()
      .catch(() => setError('Could not load board seats. Reload to try again.'))
      .finally(() => setLoading(false))
  }, [])

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
    } catch {
      setError(failure)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-[#1a2744]">Board seats</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Link member accounts to each seat. Messages sent through the board page
          stay with the seat, so whoever holds it next sees the full history.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {seats.map((seat) => (
          <SeatRow
            key={seat.id}
            seat={seat}
            holders={holders.filter((h) => h.seat_id === seat.id)}
            history={history.filter((h) => h.seat_id === seat.id)}
            members={members}
            busy={busy}
            onAssign={(seatId, memberId) =>
              run(
                () => adminAssignBoardSeat(seatId, memberId),
                'That change didn\u2019t save. Try again.',
              )
            }
            onRemove={(seatId, memberId) =>
              run(
                () => adminRemoveBoardSeatHolder(seatId, memberId),
                'Could not remove that holder.',
              )
            }
            onVacate={(seatId) =>
              run(
                () => adminAssignBoardSeat(seatId, null),
                'Could not vacate that seat.',
              )
            }
          />
        ))}
      </div>
    </div>
  )
}