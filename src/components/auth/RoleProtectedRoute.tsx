import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '@/contexts/auth-context'
import { canManageClub, isViewOnlyAdmin, toolsHomeFor, type MemberRole } from '@/lib/roles'

interface RoleProtectedRouteProps {
  children: ReactNode
  roles?: MemberRole[]
  requireClubMatch?: boolean
  requireTournamentAccess?: boolean
  /**
   * On a role mismatch, send the person to their own tools page (workspace
   * for reps/directors/auditors) rather than the dashboard.
   */
  fallbackToToolsHome?: boolean
  /** Also let in anyone assigned to direct at least one event. */
  allowDirectors?: boolean
}

function canAccessTournament(
  role: MemberRole,
  tournamentId: string,
  directedTournamentIds: string[],
): boolean {
  if (role === 'lca_admin' || isViewOnlyAdmin(role)) return true
  // Anyone assigned to direct this event, whatever their role.
  if (directedTournamentIds.includes(tournamentId)) return true
  if (role === 'club_rep') return true
  return false
}

export function RoleProtectedRoute({
  children,
  roles,
  requireClubMatch,
  requireTournamentAccess,
  fallbackToToolsHome,
  allowDirectors,
}: RoleProtectedRouteProps) {
  const {
    user,
    role,
    member,
    loading,
    memberLoading,
    directedTournamentIds,
    managedClubs,
    mfaRequired,
  } = useAuth()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()

  if (loading || memberLoading) {
    return (
      <div className="mx-auto flex max-w-6xl items-center justify-center px-6 py-24">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  const regionalClubIds = managedClubs.map((c) => c.id)
  if (requireClubMatch && id && !isViewOnlyAdmin(role) && !canManageClub(role, member?.club_id, id, regionalClubIds)) {
    return <Navigate to="/dashboard" replace />
  }

  if (
    requireTournamentAccess &&
    id &&
    !canAccessTournament(role, id, directedTournamentIds)
  ) {
    return <Navigate to="/dashboard" replace />
  }

  const isDirector = directedTournamentIds.length > 0
  if (roles && !roles.includes(role) && !(allowDirectors && isDirector)) {
    return <Navigate to={fallbackToToolsHome ? toolsHomeFor(role) : '/dashboard'} replace />
  }

  // Admin endpoints refuse a password-only session, so send them to set up
  // their second factor rather than into a page that will only 403.
  if (mfaRequired) {
    return <Navigate to="/account/security" replace />
  }

  return children
}
