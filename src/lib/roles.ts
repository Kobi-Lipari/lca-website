/** Least to most privileged; the admin panel offers them in this order. */
export type MemberRole =
  | 'member'
  | 'lca_auditor'
  | 'club_rep'
  | 'tournament_director'
  | 'lca_admin'

export const MEMBER_ROLES: MemberRole[] = [
  'member',
  'lca_auditor',
  'club_rep',
  'tournament_director',
  'lca_admin',
]

export const ROLE_LABELS: Record<MemberRole, string> = {
  member: 'Member',
  lca_auditor: 'LCA Auditor',
  club_rep: 'Club Representative',
  tournament_director: 'Tournament Director',
  lca_admin: 'LCA Admin',
}

export function isMemberRole(value: string | undefined | null): value is MemberRole {
  return !!value && MEMBER_ROLES.includes(value as MemberRole)
}

export function resolveRole(
  memberRole?: string | null,
  metadataRole?: string | null,
): MemberRole {
  if (isMemberRole(memberRole)) return memberRole
  if (isMemberRole(metadataRole)) return metadataRole
  return 'member'
}

export function canAccessAdmin(role: MemberRole): boolean {
  return role === 'lca_admin'
}

export function canManageClub(
  role: MemberRole,
  memberClubId: string | null | undefined,
  clubId: string,
): boolean {
  if (role === 'lca_admin') return true
  return role === 'club_rep' && memberClubId === clubId
}

/** Roles that get the club/event workspace rather than the admin panel. */
export const WORKSPACE_ROLES: MemberRole[] = ['lca_auditor', 'club_rep', 'tournament_director']

/**
 * Where "back to my tools" should go for this role: admins have the admin
 * panel, reps/directors/auditors have the workspace, everyone else the
 * dashboard. `section` picks the tournaments view in either.
 */
export function toolsHomeFor(role: MemberRole, section?: 'tournaments'): string {
  if (role === 'lca_admin') return section ? `/admin/${section}` : '/admin'
  if (WORKSPACE_ROLES.includes(role)) return section ? '/workspace?tab=events' : '/workspace'
  return '/dashboard'
}
