// src/pages/MinutesPage.tsx
import { GovLayout } from '@/areas/governance/components/GovLayout'
import { GovernanceDocuments } from '@/areas/governance/components/GovernanceDocuments'
import { useAuth } from '@/contexts/auth-context'
import { usePageTitle } from '@/hooks/usePageTitle'
import { canEditGovernance } from '@/areas/admin/roles'

export function MinutesPage() {
  usePageTitle('Meeting Minutes')
  const { role } = useAuth()
  // Admins, the LCA Observer and LCA Officers manage these documents.
  const canEdit = canEditGovernance(role)
  return (
    <GovLayout title="Meeting minutes" subtitle="Board meeting records and treasurer's reports">
      <div className="space-y-8">
        <GovernanceDocuments category="minutes" title="Meeting minutes" isAdmin={canEdit} />
        <GovernanceDocuments category="treasurer" title="Treasurer's reports" isAdmin={canEdit} />
      </div>
    </GovLayout>
  )
}