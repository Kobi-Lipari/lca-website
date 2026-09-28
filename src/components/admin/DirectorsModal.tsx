// src/components/admin/DirectorsModal.tsx
// Assign or remove tournament directors. Used by admins and club reps; the
// server (directors.ts) enforces who may assign for which event.
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  adminAssignTournamentDirector,
  adminGetMembers,
  adminGetTournamentDirectors,
  adminRemoveTournamentDirector,
  type ApiAdminMember,
  type ApiTournamentDirector,
  type ApiTournamentListItem,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { GOLD_BUTTON as GOLD } from '@/lib/brand'

export function DirectorsModal({ tournament, onClose }: {
  tournament: Pick<ApiTournamentListItem, 'id' | 'name'>
  onClose: () => void
}) {
  const [directors, setDirectors] = useState<ApiTournamentDirector[]>([])
  const [pool, setPool] = useState<ApiAdminMember[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [dirs, members] = await Promise.all([
          adminGetTournamentDirectors(tournament.id),
          // Directors are often not members of the organizing club, so reps
          // search the whole (read-only) directory, same as admins.
          adminGetMembers(),
        ])
        if (!cancelled) {
          setDirectors(dirs)
          setPool(members)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load directors')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [tournament.id])

  const query = search.trim().toLowerCase()
  const directorIds = new Set(directors.map((d) => d.member_id))
  const matches = query.length >= 2
    ? pool
        .filter((m) => !directorIds.has(m.id))
        .filter((m) =>
          m.full_name.toLowerCase().includes(query) ||
          m.email.toLowerCase().includes(query),
        )
        .slice(0, 6)
    : []

  async function assign(memberId: string) {
    setBusyId(memberId)
    setError(null)
    try {
      const dirs = await adminAssignTournamentDirector(tournament.id, memberId)
      setDirectors(dirs)
      setSearch('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign director')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(memberId: string) {
    setBusyId(memberId)
    setError(null)
    try {
      const dirs = await adminRemoveTournamentDirector(tournament.id, memberId)
      setDirectors(dirs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove director')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-md rounded-t-2xl border bg-background p-6 shadow-lg sm:rounded-xl">
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-border sm:hidden" />
        <div className="mb-1 flex items-start justify-between">
          <h3 className="text-base font-semibold text-lca-navy">Tournament directors</h3>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">
          {tournament.name} — directors can manage the roster, pairings, and results.
        </p>

        {error && (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground" role="status">Loading…</p>
        ) : (
          <>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current directors
            </p>
            {directors.length === 0 ? (
              <p className="mb-4 text-sm text-muted-foreground">No directors assigned yet.</p>
            ) : (
              <div className="mb-4">
                {directors.map((d) => (
                  <div key={d.member_id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.full_name}</p>
                      <p className="truncate text-xs text-muted-foreground">{d.email}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === d.member_id}
                      onClick={() => remove(d.member_id)}
                      className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      {busyId === d.member_id ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Add a director
            </p>
            <Input
              placeholder="Search members by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {query.length >= 2 && (
              matches.length > 0 ? (
                <div className="mt-2 overflow-hidden rounded-lg border">
                  {matches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between border-b border-border px-3 py-2 last:border-0">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{m.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className={cn('h-7 text-xs', GOLD)}
                        disabled={busyId === m.id}
                        onClick={() => assign(m.id)}
                      >
                        {busyId === m.id ? 'Adding…' : 'Add'}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No members match "{search.trim()}".</p>
              )
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Members you add are given the Tournament Director role automatically,
              and it's removed again when they no longer direct any tournaments.
            </p>
          </>
        )}

        <Button variant="outline" className="mt-5 w-full" onClick={onClose}>Done</Button>
      </div>
    </div>
  )
}
