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

export const ROLE_LABELS: Record<MemberRole, string> = {
  member: 'Member',
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
