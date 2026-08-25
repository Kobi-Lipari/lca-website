// src/components/admin/MemberSeatsCell.tsx
//
// Member-side view of board_seat_assignments: "what does this person hold?"
// The Board seats tab is the same data read the other way round ("who holds
// this office?"). Both write through /api/admin/board-seats.

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  ApiAdminBoardSeat,
  ApiAdminMember,
  ApiSeatHolder,
} from '@/lib/api'

export function MemberSeatsCell({
  member, seats, holders, busy, onAdd, onRemove,
}: {
  member: ApiAdminMember
  seats: ApiAdminBoardSeat[]
  holders: ApiSeatHolder[]
  busy: boolean
  onAdd: (seatId: string, memberId: string) => void
  onRemove: (seatId: string, memberId: string) => void
}) {
  const [open, setOpen] = useState(false)
  // Set when picking an unshared seat someone else holds — assigning would
  // evict them, so it asks first rather than silently replacing.
  const [confirming, setConfirming] = useState<ApiAdminBoardSeat | null>(null)

  const held = holders.filter((h) => h.member_id === member.id)
  const heldSeatIds = new Set(held.map((h) => h.seat_id))
  const available = seats.filter((s) => s.is_active && !heldSeatIds.has(s.id))

  function occupantOf(seat: ApiAdminBoardSeat): ApiSeatHolder | undefined {
    return holders.find((h) => h.seat_id === seat.id)
  }

  function pick(seat: ApiAdminBoardSeat) {
    const occupant = occupantOf(seat)
    if (occupant && !seat.is_shared) {
      setConfirming(seat)
      return
    }
    onAdd(seat.id, member.id)
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1">
        {held.map((h) => {
          const seat = seats.find((s) => s.id === h.seat_id)
          return (
            <span
              key={h.assignment_id}
              className="inline-flex items-center gap-1 rounded-full border border-[#c8a94a]/40 bg-[#c8a94a]/10 px-2 py-0.5 text-[10px] font-medium text-[#7a5c00]"
            >
              {seat?.role ?? 'Seat'}
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(h.seat_id, member.id)}
                className="hover:text-destructive disabled:opacity-40"
                aria-label={`Remove ${member.full_name} from ${seat?.role ?? 'seat'}`}
              >
                <X className="size-2.5" />
              </button>
            </span>
          )
        })}

        <button
          type="button"
          disabled={busy}
          onClick={() => { setOpen((o) => !o); setConfirming(null) }}
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-[#c8a94a] hover:text-[#7a5c00]',
            held.length === 0 && 'border-solid',
          )}
        >
          <Plus className="size-2.5" /> {held.length === 0 ? 'Seat' : ''}
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setConfirming(null) }} />
          <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border bg-background p-1 shadow-lg">
            {confirming ? (
              <div className="p-2">
                <p className="text-xs text-foreground">
                  <span className="font-semibold">{confirming.role}</span> is held by{' '}
                  {occupantOf(confirming)?.member_name}. Assigning {member.full_name}{' '}
                  ends their term and removes their access to that inbox.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="flex-1 rounded-md bg-[#1a2744] px-2 py-1 text-[11px] font-medium text-white"
                    onClick={() => {
                      onAdd(confirming.id, member.id)
                      setConfirming(null)
                      setOpen(false)
                    }}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    className="flex-1 rounded-md border px-2 py-1 text-[11px]"
                    onClick={() => setConfirming(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : available.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                No other seats available.
              </p>
            ) : (
              available.map((seat) => {
                const occupant = occupantOf(seat)
                return (
                  <button
                    key={seat.id}
                    type="button"
                    onClick={() => pick(seat)}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                  >
                    <span className="font-medium text-[#1a2744]">{seat.role}</span>
                    {seat.is_shared === 1 ? (
                      <span className="ml-1 text-[10px] text-muted-foreground">· shared</span>
                    ) : occupant ? (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        · held by {occupant.member_name}
                      </span>
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        </>
      )}
    </div>
  )
}