// src/components/admin/TournamentList.tsx
// The "your tournaments" list plus the new-tournament wizard. Shared by the
// admin panel (every event, with a club column) and the club workspace
// (only the events that person manages). Callers pass an already-scoped list.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { EyeOff, Plus, Trophy, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DirectorsModal } from '@/components/admin/DirectorsModal'
import { TournamentWizard } from '@/components/admin/TournamentWizard'
import type { ApiClubListItem, ApiTournamentListItem } from '@/lib/api'
import { cn } from '@/lib/utils'
import { GOLD_BUTTON as GOLD } from '@/lib/brand'

const STATUS: Record<string, { label: string; className: string }> = {
  upcoming: { label: 'Upcoming', className: 'bg-lca-gold/15 text-[#7a5c00] border border-lca-gold/40' },
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Done', className: 'bg-muted text-muted-foreground border border-border' },
}

export function TournamentList({
  tournaments,
  canCreate,
  canAssignDirectors,
  clubs,
  onClubChange,
  savingId,
  emptyHint,
}: {
  tournaments: ApiTournamentListItem[]
  canCreate: boolean
  /** Per event: may this person add/remove its directors? */
  canAssignDirectors: (t: ApiTournamentListItem) => boolean
  /** Admins only: shows the organizing-club picker in the wizard and on each row. */
  clubs?: ApiClubListItem[]
  onClubChange?: (t: ApiTournamentListItem, clubId: string | null) => void
  savingId?: string | null
  emptyHint?: string
}) {
  const [showCreate, setShowCreate] = useState(false)
  const [directorsFor, setDirectorsFor] = useState<ApiTournamentListItem | null>(null)
  const [showCompleted, setShowCompleted] = useState(false)

  const current = tournaments.filter((t) => t.status !== 'completed')
  const completed = tournaments.filter((t) => t.status === 'completed').reverse()

  if (showCreate) {
    return (
      <TournamentWizard
        templates={tournaments}
        clubs={clubs}
        onCancel={() => setShowCreate(false)}
      />
    )
  }

  function row(t: ApiTournamentListItem) {
    const sc = STATUS[t.status] ?? STATUS.upcoming
    const isDraft = t.is_visible === 0
    return (
      <div key={t.id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate font-semibold text-lca-navy">{t.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t.date} · {t.location}{t.rounds ? ` · ${t.rounds} rounds` : ''}
              {!clubs && t.club_name ? ` · ${t.club_name}` : ''}
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {isDraft && (
              <span className="flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground" title="Hidden from the public until made visible">
                <EyeOff className="size-3" /> Draft
              </span>
            )}
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', sc.className)}>{sc.label}</span>
            <Button asChild size="sm" className={cn('h-7 text-xs', t.status === 'completed' ? '' : GOLD)} variant={t.status === 'completed' ? 'outline' : 'default'}>
              <Link to={`/admin/tournaments/${t.id}`}>{t.status === 'completed' ? 'Open' : 'Manage'}</Link>
            </Button>
          </div>
        </div>
        {(clubs || canAssignDirectors(t)) && (
          <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-border/60 bg-muted/10 px-5 py-2">
            {clubs && onClubChange && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Club
                <select
                  className="max-w-[200px] rounded-md border bg-background px-2 py-1 text-xs text-foreground"
                  value={t.club_id ?? ''}
                  disabled={savingId === t.id}
                  onChange={(e) => onClubChange(t, e.target.value || null)}
                >
                  <option value="">LCA (no club)</option>
                  {clubs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            {canAssignDirectors(t) && (
              <button type="button" onClick={() => setDirectorsFor(t)}
                className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground">
                <Users className="size-3" /> Directors
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {directorsFor && (
        <DirectorsModal tournament={directorsFor} onClose={() => setDirectorsFor(null)} />
      )}

      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tournaments · {current.length} current
        </h2>
        {canCreate && (
          <Button type="button" className={GOLD} size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="mr-1.5 size-3.5" /> New tournament
          </Button>
        )}
      </div>

      {tournaments.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-12 text-center">
          <Trophy className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium text-lca-navy">No tournaments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {emptyHint ?? (canCreate ? 'Create your first tournament to get started.' : 'Events you are assigned to will appear here.')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {current.length === 0 && (
            <p className="rounded-xl border border-dashed px-5 py-6 text-center text-sm text-muted-foreground">
              Nothing upcoming right now.
            </p>
          )}
          {current.map(row)}

          {completed.length > 0 && (
            <div className="pt-3">
              <button type="button" onClick={() => setShowCompleted((v) => !v)}
                className="text-sm font-medium text-lca-navy hover:underline">
                {showCompleted ? 'Hide' : 'Show'} {completed.length} completed
              </button>
              {showCompleted && <div className="mt-3 space-y-3">{completed.map(row)}</div>}
            </div>
          )}
        </div>
      )}
    </>
  )
}
