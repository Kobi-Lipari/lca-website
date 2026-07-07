// BylawsPage.tsx
import { GovLayout } from '@/components/governance/GovLayout'
import { GovernanceDocuments } from '@/components/governance/GovernanceDocuments'
import { useAuth } from '@/contexts/AuthContext'
import { usePageTitle } from '@/hooks/usePageTitle'

export function BylawsPage() {
  usePageTitle('Bylaws')
  const { role } = useAuth()
  return (
    <GovLayout title="Bylaws" subtitle="Official constitution of the Louisiana Chess Association">
      <div className="space-y-8">
        <GovernanceDocuments category="bylaws" title="Bylaws documents" isAdmin={role === 'lca_admin'} layout="preview" />
        <GovernanceDocuments category="amendments" title="Proposed amendments" isAdmin={role === 'lca_admin'} layout="preview" />
      </div>
    </GovLayout>
  )
}