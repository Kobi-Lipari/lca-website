// src/pages/ManageClubPage.tsx
//
// The old way in to a club's tools. With clubKeepers off it sends a club's
// rep to the admin club page, as it always has. With clubKeepers on it sends
// a club's rep to Your club's page, by the club's id, which that page turns
// into the club's page address once it has the club, and an LCA admin to
// the Clubs list (WS09 step 9).
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/contexts/auth-context'
import { keepersOn } from '@/areas/clubs/switches'

export function ManageClubPage() {
  const { member, memberLoading, role } = useAuth()

  if (memberLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (keepersOn()) {
    if (role === 'lca_admin') return <Navigate to="/admin/clubs" replace />
    if (role === 'club_rep' && member?.club_id) return <Navigate to={`/my/club/${member.club_id}`} replace />
    return <Navigate to="/dashboard" replace />
  }

  // Belonging to a club is not the same as managing one: ordinary members
  // have a club_id too, and sending them to the admin page just 403s every
  // API call it makes. Only reps and admins proceed.
  const canManage = role === 'club_rep' || role === 'lca_admin'

  if (!member?.club_id || !canManage) {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to={`/admin/clubs/${member.club_id}`} replace />
}
