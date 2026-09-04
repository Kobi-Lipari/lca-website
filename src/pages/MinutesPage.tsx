// src/pages/MinutesPage.tsx
import { GovLayout } from '@/components/governance/GovLayout'
import { GovernanceDocuments } from '@/components/governance/GovernanceDocuments'
import { useAuth } from '@/contexts/auth-context'
import { usePageTitle } from '@/hooks/usePageTitle'

export function MinutesPage() {
  usePageTitle('Meeting Minutes')
  const { role } = useAuth()
  return (
    <GovLayout title="Meeting minutes" subtitle="Board meeting records and treasurer's reports">
      <div className="space-y-8">
        <GovernanceDocuments category="minutes" title="Meeting minutes" isAdmin={role === 'lca_admin'} />
        <GovernanceDocuments category="treasurer" title="Treasurer's reports" isAdmin={role === 'lca_admin'} />
      </div>
    </GovLayout>
  )
}