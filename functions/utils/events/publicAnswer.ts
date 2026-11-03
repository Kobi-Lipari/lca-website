// functions/utils/events/publicAnswer.ts
//
// What the two public tournament answers, GET /api/tournaments and GET
// /api/tournaments/[id], leave out for anyone who does not manage the event
// (the Phase 0 trim of the public answers, D15 and D29):
// - created_by, keep_apart and report_settings, which no public page reads,
//   are answered only to the event's managers, with no switch (brief 0.2:
//   a field no page reads needs none);
// - once ROSTER_SHORT_NAMES is set, the detail's roster writes each entrant
//   under 18 as first name and last initial (publicName in
//   domain/households/publicName.ts); the standings and the prizes are
//   worked out from the full roster before it is written, and keep full
//   names (D3).
// The event's managers are the people canManageTournament
// (functions/utils/admin/permissions.ts) names, and the observers: an LCA
// admin and an observer manage every event, a club rep the events of their
// own club, and anyone but a guest the events they are assigned to direct.
// Both handlers answer through toTournamentResponse first, as
// test/unit/sections-reader-audit.test.ts holds them to.

import { MANAGER_ONLY_TOURNAMENT_KEYS } from '../../../domain/contracts/events'
import { publicName } from '../../../domain/households/publicName'
import { getDirectedTournamentIds } from '../admin/permissions'
import { isObserver } from '../auth'

/**
 * Set: the roster of GET /api/tournaments/[id] writes each entrant under 18
 * as first name and last initial for anyone who does not manage the event.
 * Turned on with rosterShortNames in src/lib/features.ts, in the same change;
 * test/unit/public-answer-switches.test.ts holds the two equal.
 */
export const ROSTER_SHORT_NAMES = false

type ManagerOnlyKey = (typeof MANAGER_ONLY_TOURNAMENT_KEYS)[number]

/** A tournament answer whose manager-only keys may be left out. */
export type PublicTournamentAnswer<Answer> = Omit<Answer, ManagerOnlyKey> & Partial<Pick<Answer, Extract<keyof Answer, ManagerOnlyKey>>>

/**
 * A tournament as a public answer gives it: the answer toTournamentResponse
 * made, unchanged for someone who manages the event, and otherwise without
 * created_by, keep_apart and report_settings, the keys left out rather than
 * set to null. The answer handed in is not changed.
 */
export function publicTournamentAnswer<Answer extends object>(answer: Answer, manages: boolean): PublicTournamentAnswer<Answer> {
  if (manages) return answer
  const trimmed = { ...answer } as Record<string, unknown>
  for (const key of MANAGER_ONLY_TOURNAMENT_KEYS) delete trimmed[key]
  return trimmed as PublicTournamentAnswer<Answer>
}

/** Who is asking, as GET /api/tournaments knows them. */
export interface ListViewer {
  role: string
  id: string
  clubId: string | null
}

/** An event as the list's manager rule reads it. */
export interface ManagedEvent {
  id: string
  club_id: string | null
}

/**
 * Which listed events the viewer manages, by the rule the detail answer
 * applies to one event (canManageTournament, or an observer): an LCA admin
 * and an observer manage them all; a club rep the events of their own club;
 * anyone but a guest the events they are assigned to direct; someone signed
 * out, none. The viewer's assignments are read once, never once an event.
 */
export async function eventsManagedBy(db: D1Database, viewer: ListViewer | null): Promise<(event: ManagedEvent) => boolean> {
  if (!viewer) return () => false
  if (viewer.role === 'lca_admin' || isObserver(viewer)) return () => true
  const directed = new Set(viewer.role === 'guest' ? [] : await getDirectedTournamentIds(db, viewer.id))
  return (event) =>
    (viewer.role === 'club_rep' && !!event.club_id && viewer.clubId === event.club_id) || directed.has(event.id)
}

/**
 * A roster row as GET /api/tournaments/[id] reads it: the answer's columns,
 * and the two signs that the entrant is under 18 (D15), each 1 or 0.
 */
export interface RosterRead {
  member_id: string
  section: string
  withdrawn_at: string | null
  rating_at_entry: number | null
  full_name: string
  uscf_id: string | null
  uscf_rating: number | null
  /** 1 when the player has a guardian link: members.guardian_id is set. */
  guardian_link: number
  /** 1 when the entry confirmed a scholastic range: registrations.grade is set. */
  entry_marked: number
}

/** A roster row as the answer gives it. */
export type RosterEntry = Omit<RosterRead, 'guardian_link' | 'entry_marked'>

/**
 * The roster as the answer gives it, the two signs left out. With `shorten`
 * (ROSTER_SHORT_NAMES set and a viewer who does not manage the event), each
 * name is written as publicName writes it on the entrants list: an entrant
 * with a guardian link or a confirmed scholastic range as first name and
 * last initial, everyone else in full. Without it every name is as stored.
 */
export function publicRoster(rows: readonly RosterRead[], shorten: boolean): RosterEntry[] {
  return rows.map(({ guardian_link, entry_marked, ...entry }) => {
    if (!shorten) return entry
    const fullName = publicName({ fullName: entry.full_name, hasActiveGuardianLink: guardian_link === 1, entryMarkedMinor: entry_marked === 1 }, 'entrants')
    return { ...entry, full_name: fullName }
  })
}
