// src/pages/ManageClubPage.tsx

import { Navigate } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'

export function ManageClubPage() {
  const { member, memberLoading, role } = useAuth()

  if (memberLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  // Belonging to a club is not the same as managing one — ordinary members
  // have a club_id too, and sending them to the admin page just 403s every
  // API call it makes. Only reps and admins proceed.
  const canManage = role === 'club_rep' || role === 'lca_admin'

  if (!member?.club_id || !canManage) {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to={`/admin/clubs/${member.club_id}`} replace />
}
