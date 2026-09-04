// src/lib/tournamentStatus.ts
//
// Lives outside StatusBadge so that module exports components and nothing
// else — a module mixing the two loses Fast Refresh for everything in it.
import type { BadgeTone } from '@/components/StatusBadge'

export const TOURNAMENT_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  upcoming: { label: 'Upcoming', tone: 'gold' },
  active: { label: 'Active', tone: 'emerald' },
  completed: { label: 'Completed', tone: 'muted' },
}
