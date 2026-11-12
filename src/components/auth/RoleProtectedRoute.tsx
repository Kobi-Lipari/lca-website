import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '@/contexts/auth-context'
import { MediaManagerAnswerContext } from '@/areas/admin/mediaManagerAnswer'
import { canManageClub, isViewOnlyAdmin, toolsHomeFor, type MemberRole } from '@/areas/admin/roles'
import { useMediaManager } from '@/areas/admin/useMediaManager'
import { FEATURES } from '@/lib/features'

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
  /**
   * With mailLists on, also let in the media manager (WS16 step 6), a member
   * whose role the roles list does not hold, when the server says they hold
   * the Media manager seat, and hand the page inside the answer it was let in
   * on. While that answer is on the way the route shows its loading line, as
   * while a session loads. With mailLists off this changes nothing and
   * nothing is asked.
   */
  allowMediaManager?: boolean
}

/** What the route shows while a session, or the media manager's answer, is on the way. */
function StillLoading() {
  return (
    <div className="mx-auto flex max-w-6xl items-center justify-center px-6 py-24">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  )
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
  allowMediaManager,
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
  // Asked only with mailLists on, for a route that lets the media manager in, and for a signed-in member whose role
  // Admin does not let in; called ahead of every return below, so it is called on every draw.
  const mediaManager = useMediaManager(!!allowMediaManager)

  if (loading || memberLoading) {
    return <StillLoading />
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
    // The media manager is let in by the server's answer, never by a guess: until it comes, nothing of the page is drawn
    // and nobody is sent away, and anyone it does not name is sent where today's rule sends them.
    if (allowMediaManager && FEATURES.mailLists && mediaManager.asking) return <StillLoading />
    if (!(allowMediaManager && FEATURES.mailLists && mediaManager.mediaManager)) {
      return <Navigate to={fallbackToToolsHome ? toolsHomeFor(role) : '/dashboard'} replace />
    }
  }

  // Admin endpoints refuse a password-only session, so send them to set up
  // their second factor rather than into a page that will only 403.
  if (mfaRequired) {
    return <Navigate to="/account/security" replace />
  }

  if (!allowMediaManager || !FEATURES.mailLists) return children
  return <MediaManagerAnswerContext.Provider value={mediaManager}>{children}</MediaManagerAnswerContext.Provider>
}
