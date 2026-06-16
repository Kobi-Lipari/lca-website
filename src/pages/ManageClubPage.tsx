import { Navigate } from 'react-router-dom'

import { useAuth } from '@/contexts/AuthContext'

export function ManageClubPage() {
  const { member, memberLoading } = useAuth()

  if (memberLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!member?.club_id) {
    return <Navigate to="/dashboard" replace />
  }

  return <Navigate to={`/admin/clubs/${member.club_id}`} replace />
}
