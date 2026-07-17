// src/lib/clearinghouse.ts
//
// Shared types + helpers for the unified tournament feed
// (GET /api/clearinghouse — LCA events merged with Gulf South external
// events). Used by TournamentsPage and ScholasticPage.

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
  sections?: Array<string | { name: string }>
  rounds?: number | null
  status?: string | null
  is_rated?: number | null
  club_id?: string | null
  club_color?: string | null
  club_name?: string | null
  time_control?: string | null
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