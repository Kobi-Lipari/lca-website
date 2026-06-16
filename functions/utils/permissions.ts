import type { MemberRow } from '../types'

export type MemberRole =
  | 'member'
  | 'club_rep'
  | 'tournament_director'
  | 'lca_admin'

export const MEMBER_ROLES: MemberRole[] = [
  'member',
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

  if (member.role === 'tournament_director') {
    return isTournamentDirector(db, member.id, tournamentId)
  }

  return false
}

export async function canManageClub(
  member: MemberRow,
  clubId: string,
): Promise<boolean> {
  if (member.role === 'lca_admin') return true
  return member.role === 'club_rep' && member.club_id === clubId
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
