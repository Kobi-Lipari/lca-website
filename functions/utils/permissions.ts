// functions/utils/permissions.ts
import type { MemberRow } from '../types'

/**
 * Ordered least to most privileged, which is also the order they are offered
 * in the admin panel. lca_auditor reads the member directory and nothing
 * else; every role above it can do that too, so raising someone's role never
 * takes the directory away.
 */
export type MemberRole =
  | 'member'
  | 'lca_auditor'
  | 'lca_officer'
  | 'lca_observer'
  | 'club_rep'
  | 'tournament_director'
  | 'lca_admin'

export const MEMBER_ROLES: MemberRole[] = [
  'member',
  'lca_auditor',
  'lca_officer',
  'lca_observer',
  'club_rep',
  'tournament_director',
  'lca_admin',
]

export function isMemberRole(value: string): value is MemberRole {
  return MEMBER_ROLES.includes(value as MemberRole)
}

export async function isTournamentDirector(
  db: D1Database,
  memberId: string,
  tournamentId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      'SELECT 1 FROM tournament_directors WHERE tournament_id = ? AND member_id = ?',
    )
    .bind(tournamentId, memberId)
    .first()
  return !!row
}

export async function getTournamentClubId(
  db: D1Database,
  tournamentId: string,
): Promise<string | null> {
  const row = await db
    .prepare('SELECT club_id FROM tournaments WHERE id = ?')
    .bind(tournamentId)
    .first<{ club_id: string | null }>()
  return row?.club_id ?? null
}

export async function canManageTournament(
  db: D1Database,
  member: MemberRow,
  tournamentId: string,
): Promise<boolean> {
  if (member.role === 'lca_admin') return true

  const clubId = await getTournamentClubId(db, tournamentId)
  if (
    member.role === 'club_rep' &&
    clubId &&
    member.club_id === clubId
  ) {
    return true
  }

  // A director assignment is access to that one event, whoever holds it.
  // Being assigned no longer changes anyone's role: a club rep naming a
  // member as director gives that member this event and nothing else.
  if (member.role === 'guest') return false
  return isTournamentDirector(db, member.id, tournamentId)
}

/**
 * Clubs a member manages as a regional representative: every club whose
 * region is covered by a regional seat they currently hold. Like all board
 * access this is a grant on the seat, not the account, so it starts and ends
 * with the term and never touches members.role or members.club_id.
 */
export async function getRegionalClubIds(
  db: D1Database,
  memberId: string,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT DISTINCT c.id
         FROM board_seat_assignments a
         JOIN board_members s ON s.id = a.seat_id
         JOIN seat_regions r  ON r.seat_id = s.id
         JOIN clubs c         ON c.region = r.region
        WHERE a.member_id = ?
          AND a.ended_at IS NULL
          AND s.is_active = 1
          AND s.category = 'regional_rep'`,
    )
    .bind(memberId)
    .all<{ id: string }>()
  return (results ?? []).map((r) => r.id)
}

export async function isRegionalRepFor(
  db: D1Database,
  memberId: string,
  clubId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1
         FROM board_seat_assignments a
         JOIN board_members s ON s.id = a.seat_id
         JOIN seat_regions r  ON r.seat_id = s.id
         JOIN clubs c         ON c.region = r.region
        WHERE a.member_id = ?
          AND c.id = ?
          AND a.ended_at IS NULL
          AND s.is_active = 1
          AND s.category = 'regional_rep'
        LIMIT 1`,
    )
    .bind(memberId, clubId)
    .first()
  return !!row
}

/**
 * The club's own page, officers, news, logo and roster: admins, the club's
 * rep, and the regional representative for the club's region.
 */
export async function canManageClub(
  db: D1Database,
  member: MemberRow,
  clubId: string,
): Promise<boolean> {
  if (member.role === 'lca_admin') return true
  if (member.role === 'club_rep' && member.club_id === clubId) return true
  if (member.role === 'guest') return false
  return isRegionalRepFor(db, member.id, clubId)
}

export async function getDirectedTournamentIds(
  db: D1Database,
  memberId: string,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      'SELECT tournament_id FROM tournament_directors WHERE member_id = ?',
    )
    .bind(memberId)
    .all<{ tournament_id: string }>()
  return (results ?? []).map((row) => row.tournament_id)
}
