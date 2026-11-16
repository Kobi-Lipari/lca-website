// src/areas/clubs/components/ClubWaitingEvents.tsx
//
// The admin club page's events that wait for LCA approval (WS09 step 19),
// drawn on its Tournaments tab with regionEvents on: a row for each event of
// the club that is marked for approval and not yet approved, each with
// ApprovalWait's Approve and publish and Ask for changes. It reads the
// club's answer itself, GET /api/admin/clubs/[id], whose `eventRights.decide`
// says whether the person approves (an LCA admin) and whose rows carry the
// wait's columns, both sent only while REGION_EVENTS_ON is set; with neither
// in the answer, or with no event waiting, it draws nothing, so for everyone
// but an LCA admin the tab is as before. A row stays after its move, showing
// the state the answer gives, so the focus is never lost with it, and the
// page is told so its own list follows.
import { useEffect, useState } from 'react'

import { adminGetClub, type ApiAdminClubTournament } from '@/lib/api'
import { errorWords } from '@/areas/clubs/region'
import { formatDate } from '@/lib/format'
import { approvalState } from '@domain/events/approval'
import type { TournamentApprovalResponse } from '@domain/contracts'
import { ApprovalWait } from './ApprovalWait'

/** The event's three columns of the wait, as a row of the club's answer gives them. */
function waitOf(row: ApiAdminClubTournament) {
  return {
    id: row.id,
    name: row.name,
    needs_lca_approval: row.needs_lca_approval ?? 0,
    approval_requested_at: row.approval_requested_at ?? null,
    approved_at: row.approved_at ?? null,
  }
}

type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; text: string }
  | { kind: 'ready'; decide: boolean; rows: ApiAdminClubTournament[] }

export function ClubWaitingEvents({ clubId, onMoved }: {
  clubId: string
  /** A move went through on one of the club's events: the page's own list follows the answer. */
  onMoved: (tournamentId: string, answer: TournamentApprovalResponse) => void
}) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  useEffect(() => {
    let cancelled = false
    adminGetClub(clubId)
      .then((data) => {
        if (cancelled) return
        const rows = (data.tournaments ?? []).filter((row) => {
          const state = approvalState(waitOf(row))
          return state === 'draft' || state === 'in_review'
        })
        setLoad({ kind: 'ready', decide: !!data.eventRights?.decide, rows })
      })
      .catch((err) => { if (!cancelled) setLoad({ kind: 'failed', text: `The events waiting for LCA approval could not be loaded: ${errorWords(err)}` }) })
    return () => { cancelled = true }
  }, [clubId])

  if (load.kind === 'loading') return null
  if (load.kind === 'failed') return <p role="status" className="break-words text-sm text-ink">{load.text}</p>
  if (!load.decide || load.rows.length === 0) return null

  function moved(row: ApiAdminClubTournament, answer: TournamentApprovalResponse) {
    setLoad((now) => (now.kind === 'ready'
      ? {
          ...now,
          rows: now.rows.map((r) => (r.id === row.id
            ? { ...r, needs_lca_approval: answer.needs_lca_approval, approval_requested_at: answer.approval_requested_at, approved_at: answer.approved_at, ...(answer.approved_at ? { is_visible: 1 } : {}) }
            : r)),
        }
      : now))
    onMoved(row.id, answer)
  }

  return (
    <section aria-labelledby="club-waiting-title" className="space-y-3">
      <h3 id="club-waiting-title" className="text-base font-semibold text-ink">Events waiting for LCA approval</h3>
      <ul className="space-y-3">
        {load.rows.map((row) => (
          <li key={row.id} className="min-w-0 space-y-2 rounded-xl border bg-card p-4 shadow-sm">
            <p className="break-words font-medium text-ink">{row.name}</p>
            <p className="break-words text-sm text-ink">{formatDate(row.date, { year: true })}</p>
            <ApprovalWait event={waitOf(row)} maySubmit={false} mayDecide={load.decide} headingLevel={4} onMoved={(answer) => moved(row, answer)} />
          </li>
        ))}
      </ul>
    </section>
  )
}
