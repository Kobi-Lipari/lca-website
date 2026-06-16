import type { ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'
import { canManageClub, type MemberRole } from '@/lib/roles'

interface RoleProtectedRouteProps {
  children: ReactNode
  roles?: MemberRole[]
  requireClubMatch?: boolean
  requireTournamentAccess?: boolean
}

function canAccessTournament(
  role: MemberRole,
  tournamentId: string,
  directedTournamentIds: string[],
): boolean {
  if (role === 'lca_admin') return true
  if (role === 'tournament_director') {
    return directedTournamentIds.includes(tournamentId)
  }
  if (role === 'club_rep') return true
  return false
}

export function RoleProtectedRoute({
  children,
  roles,
  requireClubMatch,
  requireTournamentAccess,
}: RoleProtectedRouteProps) {
  const { user, role, member, loading, memberLoading, directedTournamentIds } =
    useAuth()
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

  if (requireClubMatch && id && !canManageClub(role, member?.club_id, id)) {
    return <Navigate to="/dashboard" replace />
  }

  if (
    requireTournamentAccess &&
    id &&
    !canAccessTournament(role, id, directedTournamentIds)
  ) {
    return <Navigate to="/dashboard" replace />
  }

  if (roles && !roles.includes(role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
