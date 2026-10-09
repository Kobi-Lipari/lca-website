// src/lib/clearinghouse.ts
//
// Shared types + helpers for the unified tournament feed
// (GET /api/clearinghouse — LCA events merged with Gulf South external
// events). Used by TournamentsPage and ScholasticPage.
import type { ApiTournamentSection } from '@/lib/api'

export interface UnifiedTournament {
  id: string
  name: string
  start_date: string
  end_date: string | null
  organizer: string | null
  city: string | null
  state: string | null
  venue: string | null
  rating_system: string | null
  eligibility: string | null
  contact: string | null
  link: string | null
  is_lca: number
  source: 'lca' | 'clearinghouse'
  registration_status?: string | null
  entry_fee?: number | null
  /** LCA events: the live sections, as every tournament answer gives them. Partner events: []. */
  sections?: ApiTournamentSection[]
  rounds?: number | null
  status?: string | null
  is_rated?: number | null
  club_id?: string | null
  club_color?: string | null
  club_name?: string | null
  time_control?: string | null
  /** LCA events only: player cap, and how many are registered (withdrawals excluded). */
  max_players?: number | null
  registered_count?: number | null
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function isPastTournament(t: UnifiedTournament): boolean {
  if (t.is_lca === 1 && t.status === 'completed') return true
  const end = new Date((t.end_date ?? t.start_date) + 'T00:00:00')
  if (isNaN(end.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return end < today
}
/**
 * Louisiana events first, then everything else — each group by date. The
 * feed also carries Gulf South events (Mississippi, Alabama…), which are
 * worth listing but shouldn't crowd out what's happening in-state.
 */
export function louisianaFirst(list: UnifiedTournament[]): UnifiedTournament[] {
  const byDate = (a: UnifiedTournament, b: UnifiedTournament) => a.start_date.localeCompare(b.start_date)
  const inState = list.filter((t) => t.state === 'LA').sort(byDate)
  const outOfState = list.filter((t) => t.state !== 'LA').sort(byDate)
  return [...inState, ...outOfState]
}

/** "12 of 40 spots filled" / "12 registered" for LCA events; null otherwise. */
export function registrationSummary(t: UnifiedTournament): string | null {
  if (t.source !== 'lca' || t.registered_count == null) return null
  if (t.max_players) return `${t.registered_count} of ${t.max_players} spots filled`
  return t.registered_count > 0 ? `${t.registered_count} registered` : null
}
