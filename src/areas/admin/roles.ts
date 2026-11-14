import { FEATURES } from '@/lib/features'

/** Least to most privileged; the admin panel offers them in this order. */
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

export const ROLE_LABELS: Record<MemberRole, string> = {
  member: 'Member',
  lca_auditor: 'LCA Auditor',
  lca_officer: 'LCA Officer',
  lca_observer: 'LCA Observer',
  club_rep: 'Club Representative',
  // With standingDirectors on, the role is named for what it is (D20). A
  // getter, so the switch is read each time a page draws the label.
  get tournament_director() {
    return FEATURES.standingDirectors ? 'Standing director' : 'Tournament Director'
  },
  lca_admin: 'LCA Admin',
}

/**
 * The one line on what the standing director role allows (D20, Q4), drawn
 * beside the role choice on the Members page while standingDirectors is on.
 */
export const STANDING_DIRECTOR_LINE =
  'A standing director creates and runs their own LCA-run tournaments here. An LCA admin grants the role on the Members page.'

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

/**
 * lca_observer (the president) and lca_officer (treasurer, secretary and
 * other officers) see the admin panel in view-only mode. Both can answer
 * support tickets and manage bylaws and minutes; only the observer has the
 * mailing tools. Mirrors OBSERVER_ROLES in functions/utils/auth.ts.
 */
export const OBSERVER_ROLES: MemberRole[] = ['lca_observer', 'lca_officer']

/** Roles that open the admin panel. Observers and officers see it view-only. */
export const ADMIN_PANEL_ROLES: MemberRole[] = ['lca_admin', ...OBSERVER_ROLES]

export function canAccessAdmin(role: MemberRole): boolean {
  return ADMIN_PANEL_ROLES.includes(role)
}

/** Sees everything an admin sees; can't change anything except a few tools. */
export function isViewOnlyAdmin(role: MemberRole): boolean {
  return OBSERVER_ROLES.includes(role)
}

/** Group email and emailing a tournament's entrants. */
export function canUseMailing(role: MemberRole): boolean {
  return role === 'lca_admin' || role === 'lca_observer'
}

/** Adding, editing and removing bylaws, rules, minutes and treasurer's reports. */
export function canEditGovernance(role: MemberRole): boolean {
  return role === 'lca_admin' || OBSERVER_ROLES.includes(role)
}

/**
 * A club's management page. `regionalClubIds` are the clubs this member
 * manages as a regional representative (from their board seat).
 */
export function canManageClub(
  role: MemberRole,
  memberClubId: string | null | undefined,
  clubId: string,
  regionalClubIds: string[] = [],
): boolean {
  if (role === 'lca_admin') return true
  if (role === 'club_rep' && memberClubId === clubId) return true
  return regionalClubIds.includes(clubId)
}

/**
 * Whether canManageClub admits this member to any club at all: an LCA
 * admin, a club's rep who has a club, or a member whose regional seat covers
 * a club. Your club's page asks it before it knows which club its address
 * names, then asks canManageClub of the club it is answered.
 */
export function keepsAnyClub(
  role: MemberRole,
  memberClubId: string | null | undefined,
  regionalClubIds: string[] = [],
): boolean {
  if (role === 'lca_admin') return true
  if (role === 'club_rep' && !!memberClubId) return true
  return regionalClubIds.length > 0
}

/** Roles that get the club/event workspace rather than the admin panel. */
export const WORKSPACE_ROLES: MemberRole[] = ['lca_auditor', 'club_rep', 'tournament_director']

/**
 * Where "back to my tools" should go for this role: admins have the admin
 * panel, reps/directors/auditors have the workspace, everyone else the
 * dashboard. `section` picks the tournaments view in either.
 */
export function toolsHomeFor(role: MemberRole, section?: 'tournaments'): string {
  if (canAccessAdmin(role)) return section ? `/admin/${section}` : '/admin'
  if (WORKSPACE_ROLES.includes(role)) return section ? '/workspace?tab=events' : '/workspace'
  return '/dashboard'
}
